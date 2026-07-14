import { describe, expect, test } from "bun:test";

import type { InspireClient } from "../src/client";
import { listCurrentUserJobs, renderJobs } from "../src/jobs";

class FakeClient {
  async whoami(): Promise<Record<string, unknown>> {
    return { id: "user-1", name: "Alice" };
  }

  async getJson(): Promise<Record<string, unknown>> {
    return {
      data: {
        routes: [{ name: "userWorkspaceList", routes: [{ name: "训练空间", path: "ws-1" }] }],
      },
    };
  }

  async postJson(path: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
    expect(path).toContain("Action=ListJobs");
    expect(body.created_by).toBe("user-1");
    expect(body.status).toBe("job_running");
    return {
      Result: {
        total: 1,
        jobs: [{
          job_id: "job-1",
          name: "train-a",
          status: "job_running",
          workspace_id: "ws-1",
          project_name: "demo",
          created_at: "1784030400000",
          framework_config: [{ gpu_count: 4 }],
        }],
      },
    };
  }
}

describe("job listing", () => {
  test("lists current user's v2 jobs", async () => {
    const rows = await listCurrentUserJobs(new FakeClient() as unknown as InspireClient, {
      status: "RUNNING",
      limit: 20,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe("RUNNING");
    expect(rows[0]?.createdAt).toBe("2026-07-14T12:00:00.000Z");
    expect(rows[0]?.createdAtMs).toBe(1784030400000);
    expect(renderJobs(rows)).toContain("train-a");
  });
});
