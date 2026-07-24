import { describe, expect, test } from "bun:test";

import type { InspireClient } from "../src/platform/client";
import { listParticipatingProjects, renderProjects } from "../src/domain/projects";
import { availableTaskPriorities, taskPriorityValue } from "../src/platform/catalog/projects";

class FakeClient {
  async postJson(): Promise<Record<string, unknown>> {
    return {
      code: 0,
      data: {
        total: 1,
        items: [{
          id: "project-1",
          name: "课程项目",
          priority_name: "8",
          budget: 10_000,
          remain_budget: 7_500,
          member_remain_budget: 1_200,
        }],
      },
    };
  }
}

describe("projects", () => {
  test("maps legacy project limits to low/high task priorities", () => {
    expect(availableTaskPriorities(3)).toEqual(["low"]);
    expect(availableTaskPriorities(4)).toEqual(["low", "high"]);
    expect(taskPriorityValue({ id: "low", priorityLimit: 3 })).toBe(1);
    expect(taskPriorityValue({ id: "high", priorityLimit: 4 })).toBe(4);
    expect(() => taskPriorityValue({ id: "low", priorityLimit: 3 }, "high"))
      .toThrow("Available priorities: low");
  });

  test("shows participating project priority and point balances", async () => {
    const rows = await listParticipatingProjects(
      new FakeClient() as unknown as InspireClient,
    );
    expect(rows[0]).toMatchObject({
      name: "课程项目",
      availablePriorities: ["low", "high"],
      budget: 10_000,
      remaining: 7_500,
      memberRemaining: 1_200,
    });
    expect(renderProjects(rows)).toContain("课程项目");
  });
});
