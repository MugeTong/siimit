import { describe, expect, test } from "bun:test";

import {
  renderMutationResult,
  renderSubmitResult,
} from "../src/commands/jobs";

describe("mutation command output", () => {
  test("renders a concise submission result", () => {
    expect(renderSubmitResult({
      job_id: "job-123",
      status: "QUEUING",
      resource: "1xNVIDIA H100 (80GB)",
      priority: "high",
      task_priority: 4,
    })).toBe([
      "Submitted job job-123.",
      "Status: QUEUING",
      "Resource: 1xNVIDIA H100 (80GB)",
      "Priority: high (4)",
    ].join("\n"));
  });

  test("renders cancel and idempotent remove results", () => {
    expect(renderMutationResult("cancel", {
      cancelled: true,
      job_id: "job-123",
    })).toBe("Cancelled job job-123.");
    expect(renderMutationResult("remove", {
      removed: true,
      already_absent: true,
      job_id: "job-123",
    })).toBe("Job job-123 was already absent.");
  });
});
