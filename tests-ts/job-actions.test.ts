import { describe, expect, test } from "bun:test";

import type { InspireClient } from "../src/platform/client";
import { cancelJob, getJob, removeJob, validateJobId } from "../src/job-actions";

class FakeClient {
  calls: Array<{ path: string; body: Record<string, unknown> }> = [];

  async postJson(path: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
    this.calls.push({ path, body });
    if (path.includes("Action=StopJob")) return { Result: { status: "job_stopped" } };
    if (path.includes("Action=GetJob")) return {
      Result: {
        job_id: "job-123",
        name: "densecat",
        status: "job_queuing",
        project_name: "课程项目",
        priority_name: "6",
        priority_level: "HIGH",
        task_priority: 0,
        created_at: "1784036010000",
        running_time_ms: "65000",
        finished_at: "1784036075000",
        timeline: { run: "1784036010000", finished: "1784036075000" },
        framework_config: [{ gpu_count: 8, shm_gi: 0, resource_spec_price: { gpu_type: "H100" } }],
      },
    };
    return { code: 0, data: {} };
  }
}

describe("job mutations", () => {
  test("requires a full job id", () => {
    expect(() => validateJobId("densecat")).toThrow("job-...");
    expect(validateJobId("job-123")).toBe("job-123");
  });

  test("cancels through v2 StopJob", async () => {
    const client = new FakeClient();
    await cancelJob(client as unknown as InspireClient, "job-123");
    expect(client.calls[0]).toEqual({
      path: "/api/v2/train?Action=StopJob",
      body: { job_id: "job-123" },
    });
  });

  test("removes through the verified train_job delete endpoint", async () => {
    const client = new FakeClient();
    await removeJob(client as unknown as InspireClient, "job-123");
    expect(client.calls[0]).toEqual({
      path: "/api/v1/train_job/delete",
      body: { job_id: "job-123" },
    });
  });

  test("gets one job and exposes its queue state", async () => {
    const client = new FakeClient();
    const job = await getJob(client as unknown as InspireClient, "job-123");
    expect(client.calls[0]).toEqual({
      path: "/api/v2/train?Action=GetJob",
      body: { job_id: "job-123" },
    });
    expect(job.status).toBe("QUEUING");
    expect(job.resource).toBe("8xH100");
    expect(job.taskPriority).toBe(6);
    expect(job.priorityLevel).toBe("HIGH");
    expect(job.shmGiB).toBe("platform_default");
    expect(job.createdAt).toBe("2026-07-14T13:33:30.000Z");
    expect(job.startedAt).toBe("2026-07-14T13:33:30.000Z");
    expect(job.finishedAt).toBe("2026-07-14T13:34:35.000Z");
    expect(job.runningTime).toBe("00:01:05");
    expect(job.exitCode).toBeNull();
  });

  test("treats repeated removal as success", async () => {
    const client = new FakeClient();
    client.postJson = async () => ({ code: 1, message: "train job already deleted" });
    expect(await removeJob(client as unknown as InspireClient, "job-123"))
      .toEqual({ already_absent: true });
  });
});
