import { describe, expect, test } from "bun:test";

import type { InspireClient } from "../src/platform/client";
import {
  getTrainJob,
  getTrainJobLogPage,
  InstanceNotReadyError,
  removeTrainJob,
} from "../src/platform/train";

class FakeClient {
  calls: Array<{ path: string; body: Record<string, unknown> }> = [];
  response: Record<string, unknown> = {};

  async postJson(
    path: string,
    body: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    this.calls.push({ path, body });
    return this.response;
  }
}

describe("training platform API", () => {
  test("unwraps v2 results and reports action errors consistently", async () => {
    const client = new FakeClient();
    client.response = { Result: { job_id: "job-123" } };
    expect(await getTrainJob(
      client as unknown as InspireClient,
      "job-123",
    )).toEqual({ job_id: "job-123" });

    client.response = {
      ResponseMetadata: {
        Error: { Code: "InternalError", Message: "platform unavailable" },
      },
    };
    await expect(
      getTrainJob(client as unknown as InspireClient, "job-123"),
    ).rejects.toThrow("GetJob failed: InternalError: platform unavailable");
  });

  test("classifies an unregistered logging instance", async () => {
    const client = new FakeClient();
    client.response = {
      ResponseMetadata: {
        Error: {
          Code: "InternalError",
          Message: "Invalid instance names, the job ids length of instances except 1, but got 0.",
        },
      },
    };
    try {
      await getTrainJobLogPage(client as unknown as InspireClient, {});
      throw new Error("Expected getTrainJobLogPage to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(InstanceNotReadyError);
    }
  });

  test("keeps remove idempotent through the legacy v1 endpoint", async () => {
    const client = new FakeClient();
    client.response = {
      code: 1,
      message: "train job already deleted",
    };
    expect(await removeTrainJob(
      client as unknown as InspireClient,
      "job-123",
    )).toEqual({ already_absent: true });
    expect(client.calls[0]).toEqual({
      path: "/api/v1/train_job/delete",
      body: { job_id: "job-123" },
    });
  });
});
