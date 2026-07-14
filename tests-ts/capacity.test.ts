import { describe, expect, test } from "bun:test";

import type { InspireClient } from "../src/platform/client";
import { getDistributedTrainingCapacity, renderCapacity } from "../src/capacity";

class FakeClient {
  constructor(private readonly used = 10, private readonly lowPriority = 2) {}

  async getJson(path: string): Promise<Record<string, unknown>> {
    if (path.endsWith("/user/routes/default")) {
      return {
        data: {
          routes: [{
            name: "userWorkspaceList",
            routes: [{ name: "分布式训练空间", path: "ws-train" }],
          }],
        },
      };
    }
    if (path.includes("/compute_resources/logic_compute_groups/")) {
      return {
        data: {
          logic_resouces: {
            gpu_total: 16,
            gpu_used: this.used,
            gpu_low_priority_used: this.lowPriority,
          },
          gpu_type_stats: [{ gpu_info: { gpu_type_display: "H200" } }],
        },
      };
    }
    throw new Error(`Unexpected GET ${path}`);
  }

  async postJson(path: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (path.endsWith("/project/list")) {
      return { data: { items: [{ id: "project-1", name: "课程项目", priority_name: "6" }] } };
    }
    if (path.includes("logic_compute_groups/list")) {
      expect((body.filter as Record<string, unknown>).workspace_id).toBe("ws-train");
      return {
        data: {
          logic_compute_groups: [{ logic_compute_group_id: "lcg-1", name: "训练区-H200" }],
        },
      };
    }
    if (path.includes("resource_prices/logic_compute_groups")) {
      expect(body.logic_compute_group_id).toBe("lcg-1");
      expect(body.project_id).toBe("project-1");
      expect(body.task_priority).toBe(6);
      return { data: [{ gpu_count: 8 }, { gpu_count: 2 }, { gpu_count: 4 }, { gpu_count: 8 }] };
    }
    throw new Error(`Unexpected POST ${path}`);
  }
}

describe("distributed training capacity", () => {
  test("calculates live and high-priority GPU capacity", async () => {
    const rows = await getDistributedTrainingCapacity(
      new FakeClient() as unknown as InspireClient,
      "分布式训练空间",
      "课程项目",
    );
    expect(rows).toEqual([{
      group: "训练区-H200",
      gpuType: "H200",
      gpuSizes: [2, 4, 8],
      free: 6,
      overcommitted: 0,
      highPriority: 8,
      used: 10,
      preemptible: 2,
      total: 16,
    }]);
    expect(renderCapacity(rows, "分布式训练空间")).toContain("Workspace: 分布式训练空间");
  });

  test("separates overcommit from reclaimable high-priority capacity", async () => {
    const rows = await getDistributedTrainingCapacity(
      new FakeClient(20, 8) as unknown as InspireClient,
      "分布式训练空间",
      "课程项目",
    );
    expect(rows[0]).toMatchObject({
      free: 0,
      overcommitted: 4,
      preemptible: 8,
      highPriority: 4,
    });
  });
});
