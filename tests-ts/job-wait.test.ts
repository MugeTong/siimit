import { describe, expect, test } from "bun:test";

import type { JobDetail } from "../src/domain/job-actions";
import {
  parseDuration,
  parseWaitTarget,
  waitForJob,
} from "../src/domain/job-wait";

function job(status: string): JobDetail {
  return {
    jobId: "job-test",
    name: "test",
    status,
    project: "project",
    resource: "1xGPU",
    taskPriority: 1,
    priorityLevel: "LOW",
    shmGiB: "platform_default",
    createdAt: "",
    createdAtMs: null,
    startedAt: "",
    finishedAt: "",
    platformRunningTime: "00:00:00",
    exitCode: status === "SUCCEEDED" ? 0 : null,
    failureReason: null,
    node: null,
    raw: {},
  };
}

describe("waitForJob", () => {
  test("waits through state changes until terminal", async () => {
    const statuses = ["QUEUING", "CREATING", "RUNNING", "SUCCEEDED"];
    const observed: string[] = [];
    const delays: number[] = [];
    const result = await waitForJob(
      async () => job(statuses.shift()!),
      { target: "terminal" },
      {
        sleep: async (milliseconds) => { delays.push(milliseconds); },
        onStatus: (current) => observed.push(current.status),
      },
    );
    expect(result.job.status).toBe("SUCCEEDED");
    expect(result.timedOut).toBe(false);
    expect(observed).toEqual(["QUEUING", "CREATING", "RUNNING", "SUCCEEDED"]);
    expect(delays).toEqual([60_000, 60_000, 60_000]);
  });

  test("returns when running is reached", async () => {
    const statuses = ["QUEUING", "RUNNING"];
    const result = await waitForJob(
      async () => job(statuses.shift()!),
      { target: "running" },
      { sleep: async () => {} },
    );
    expect(result.job.status).toBe("RUNNING");
  });

  test("polls once per minute and stops precisely at timeout", async () => {
    let clock = 0;
    const delays: number[] = [];
    const result = await waitForJob(
      async () => job("QUEUING"),
      { target: "terminal", timeoutMs: 150_000 },
      {
        now: () => clock,
        sleep: async (milliseconds) => {
          delays.push(milliseconds);
          clock += milliseconds;
        },
      },
    );
    expect(result.timedOut).toBe(true);
    expect(delays).toEqual([60_000, 60_000, 30_000]);
  });
});

describe("wait argument parsing", () => {
  test("parses targets and durations", () => {
    expect(parseWaitTarget(undefined)).toBe("terminal");
    expect(parseWaitTarget("running")).toBe("running");
    expect(parseDuration("30s")).toBe(30_000);
    expect(parseDuration("10m")).toBe(600_000);
    expect(parseDuration("1.5h")).toBe(5_400_000);
  });

  test("rejects invalid values", () => {
    expect(() => parseWaitTarget("ready")).toThrow();
    expect(() => parseDuration("30")).toThrow();
  });
});
