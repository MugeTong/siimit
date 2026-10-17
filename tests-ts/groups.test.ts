import { describe, expect, test } from "bun:test";

import type { InspireClient } from "../src/platform/client";
import { listGroups, renderGroups } from "../src/domain/groups";

class FakeClient {
  constructor(private readonly used = 10, private readonly lowPriority = 2) {}

  async postJson(path: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (path.includes("Action=ListWorkspaces")) {
      return { Result: { items: [{ id: "ws-train", name: "分布式训练空间" }] } };
    }
    if (path.includes("Action=GetProjectForPage")) {
      return { Result: { items: [{ id: "project-1", name: "课程项目", priority_name: "6" }] } };
    }
    if (path.includes("Action=ListLogicComputeGroups")) {
      expect((body.filter as Record<string, unknown>).workspace_id).toBe("ws-train");
      return {
        Result: {
          logic_compute_groups: [{ logic_compute_group_id: "lcg-1", name: "训练区-H200" }],
        },
      };
    }
    if (path.includes("Action=GetLogicComputeGroupResourceSpecPrices")) {
      expect(body.logic_compute_group_id).toBe("lcg-1");
      expect(body.project_id).toBe("project-1");
      expect(body.task_priority).toBe(4);
      return { Result: [{ gpu_count: 8 }, { gpu_count: 2 }, { gpu_count: 4 }, { gpu_count: 8 }] };
    }
    if (path.includes("Action=GetLogicComputeGroupResource")) {
      return { Result: {
        logic_resouces: {
          gpu_total: 16,
          gpu_used: this.used,
          gpu_low_priority_used: this.lowPriority,
        },
        gpu_type_stats: [{ gpu_info: { gpu_type_display: "H200" } }],
      } };
    }
    throw new Error(`Unexpected POST ${path}`);
  }
}

describe("GPU groups", () => {
  test("reports free and low-priority GPU usage", async () => {
    const rows = await listGroups(
      new FakeClient() as unknown as InspireClient,
      "分布式训练空间",
      "课程项目",
    );
    expect(rows).toEqual([{
      id: "lcg-1",
      group: "训练区-H200",
      gpuType: "H200",
      gpuSizes: [2, 4, 8],
      free: 6,
      overcommitted: 0,
      lowPriorityUsed: 2,
      used: 10,
      total: 16,
    }]);
    const output = renderGroups(rows, "分布式训练空间");
    expect(output).toContain("Workspace: 分布式训练空间");
    expect(output).toContain("LOW PRI USED");
    expect(output).not.toContain("HIGH PRI");
    expect(output).toContain("lcg-1");
  });

  test("separates overcommit from low-priority usage", async () => {
    const rows = await listGroups(
      new FakeClient(20, 8) as unknown as InspireClient,
      "分布式训练空间",
      "课程项目",
    );
    expect(rows[0]).toMatchObject({
      free: 0,
      overcommitted: 4,
      lowPriorityUsed: 8,
    });
  });

});
