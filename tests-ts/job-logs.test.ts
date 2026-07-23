import { describe, expect, test } from "bun:test";

import {
  getContainerLogs,
  getJobEvents,
  isBenignPlatformEvent,
  isPlatformHeartbeat,
} from "../src/domain/job-logs";
import type { InspireClient } from "../src/platform/client";

class FakeClient {
  calls: Array<{ path: string; body: Record<string, unknown> }> = [];

  async postJson(path: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
    this.calls.push({ path, body });
    if (path.includes("Action=ListJobInstances")) {
      return {
        Result: {
          total: 2,
          items: [
            { name: "job-123-worker-0" },
            { name: "job-123-worker-1" },
          ],
        },
      };
    }
    if (path.includes("Action=GetJobLog")) {
      return {
        Result: {
          total: 1,
          logs: [{
            message: "hello",
            timestamp_ms: "2000",
            timestamp_str: "1970-01-01T00:00:02.000Z",
            time: "1970-01-01T00:00:02.000000000Z",
            pod_name: "job-123-worker-0",
            node: "node-1",
            log_id: "log-1",
          }],
        },
      };
    }
    if (path.includes("Action=ListJobEvents")) {
      const filter = body.filter as Record<string, unknown>;
      const scope = String(filter.object_type);
      return {
        Result: {
          total: 1,
          events: [{
            type: "Normal",
            reason: scope === "job" ? "SuccessfulCreatePod" : "Scheduled",
            from: "scheduler",
            message: "assigned",
            first_timestamp: "1",
            last_timestamp: scope === "job" ? "1" : "2",
            object_type: scope,
            object_id: scope === "job" ? "job-123" : "job-123-worker-0",
          }],
        },
      };
    }
    return {
      Result: {
        job_id: "job-123",
        status: "job_succeeded",
        created_at: "1000",
        finished_at: "3000",
        framework_config: [{ instance_count: 2 }],
      },
    };
  }
}

describe("job logs", () => {
  test("derives pods and requests container logs in the selected order", async () => {
    const client = new FakeClient();
    const result = await getContainerLogs(client as unknown as InspireClient, "job-123", 50, "desc");
    expect(client.calls[2]).toEqual({
      path: "/api/v2/train?Action=GetJobLog",
      body: {
        page_size: 50,
        filter: {
          podNames: ["job-123-worker-0", "job-123-worker-1"],
          start_timestamp_ms: "1000",
          end_timestamp_ms: "3000",
        },
        sorter: [
          { field: "time", sort: "descend" },
          { field: "log-id.keyword", sort: "descend" },
        ],
      },
    });
    expect(result.items[0]?.message).toBe("hello");
  });

  test("uses the last time and log id to load every container log page", async () => {
    class PaginatedClient extends FakeClient {
      override async postJson(path: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
        if (!path.includes("Action=GetJobLog")) return super.postJson(path, body);
        this.calls.push({ path, body });
        const cursor = body.search_after;
        const start = Array.isArray(cursor) ? 2 : 0;
        const logs = Array.from({ length: 2 }, (_, offset) => {
          const index = start + offset;
          return {
            message: `line-${index}`,
            timestamp_ms: String(2000 + index),
            time: `time-${index}`,
            log_id: `log-${index}`,
          };
        });
        return { Result: { total: 4, logs } };
      }
    }

    const client = new PaginatedClient();
    const result = await getContainerLogs(client as unknown as InspireClient, "job-123", undefined, "asc");
    expect(result.items.map((item) => item.message)).toEqual(["line-0", "line-1", "line-2", "line-3"]);
    expect(client.calls[3]?.body.search_after).toEqual(["time-1", "log-1"]);
  });

  test("uses second timestamps for job events", async () => {
    const client = new FakeClient();
    const result = await getJobEvents(
      client as unknown as InspireClient,
      "job-123",
      200,
      "asc",
    );
    expect(client.calls[2]?.body).toMatchObject({
      page_num: 1,
      page_size: 200,
      filter: {
        object_ids: ["job-123-worker-0", "job-123-worker-1"],
        start_last_timestamp: "1",
        end_last_timestamp: "3",
      },
      sorter: [{ field: "last_timestamp", sort: "ascend" }],
    });
    expect(result.items[0]?.reason).toBe("Scheduled");
    expect(result.items[0]?.firstTimestamp).toBe("1970-01-01T00:00:01.000Z");
    expect(result.items[0]?.firstTimestampMs).toBe(1000);
    expect(result.items[0]?.lastTimestamp).toBe("1970-01-01T00:00:02.000Z");
    expect(result.items[0]?.lastTimestampMs).toBe(2000);
  });

  test("merges job and instance events into one chronological timeline", async () => {
    const client = new FakeClient();
    const result = await getJobEvents(
      client as unknown as InspireClient,
      "job-123",
      200,
      "asc",
      "all",
    );
    expect(result.total).toBe(2);
    expect(result.scope).toBe("all");
    expect(result.items.map((event) => `${event.objectType}:${event.reason}`)).toEqual([
      "job:SuccessfulCreatePod",
      "instance:Scheduled",
    ]);
  });

  test("only recognizes the exact platform heartbeat line", () => {
    const log = (message: string) => ({
      message,
      timestampMs: null,
      timestamp: "",
      podName: "",
      node: "",
      logId: "",
    });
    expect(isPlatformHeartbeat(log("wait done file (retry after 1 second)..."))).toBe(true);
    expect(isPlatformHeartbeat(log("wait done file failed"))).toBe(false);
    expect(isPlatformHeartbeat(log("user: wait done file (retry after 1 second)..."))).toBe(false);
  });

  test("only hides reserving events with a successful exit code", () => {
    const event = (reason: string, message: string) => ({
      type: "Warning",
      reason,
      source: "",
      message,
      firstTimestamp: "",
      firstTimestampMs: null,
      lastTimestamp: "",
      lastTimestampMs: null,
      objectType: "instance",
      objectId: "job-123-worker-0",
    });
    expect(isBenignPlatformEvent(event("PodReservingStart", "Pod start reserving, exitCode:0"))).toBe(true);
    expect(isBenignPlatformEvent(event("JobReservingStart", "Job start reserving, exitCode: 0"))).toBe(true);
    expect(isBenignPlatformEvent(event("PodReservingStart", "Pod start reserving, exitCode:2"))).toBe(false);
    expect(isBenignPlatformEvent(event("Failed", "exitCode:0"))).toBe(false);
  });
});
