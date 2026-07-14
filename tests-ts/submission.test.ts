import { describe, expect, test } from "bun:test";
import type { InspireClient } from "../src/platform/client";
import { buildSubmissionPayload } from "../src/domain/submission";
import { DEFAULT_APP_CONFIG } from "../src/config";

class FakeClient {
  async getJson(path: string): Promise<Record<string, unknown>> {
    expect(path).toBe("/api/v1/user/routes/default");
    return {
      data: {
        routes: [{ name: "userWorkspaceList", routes: [{ name: "训练空间", path: "ws-1" }] }],
      },
    };
  }

  async postJson(path: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (path.endsWith("/project/list")) {
      return {
        data: { items: [{ id: "project-1", name: "示例项目", priority_name: "7" }] },
      };
    }
    if (path.endsWith("/logic_compute_groups/list")) {
      return { data: { logic_compute_groups: [{ logic_compute_group_id: "lcg-1", name: "H200训练区" }] } };
    }
    if (path.endsWith("/resource_prices/logic_compute_groups")) {
      expect(body.schedule_config_type).toBe("SCHEDULE_CONFIG_TYPE_TRAIN");
      expect(body.project_id).toBe("project-1");
      expect(body.task_priority).toBe(7);
      return {
        data: [{
          quota_id: "quota-1",
          gpu_count: 4,
          cpu_count: 80,
          memory_size_gib: 800,
          gpu_info: { gpu_type: "NVIDIA_H200" },
          cpu_info: { cpu_type: "CPU" },
        }],
      };
    }
    if (path.endsWith("/image/list")) {
      const filter = body.filter as Record<string, unknown>;
      if (filter.visibility === "VISIBILITY_PRIVATE") {
        return {
          data: {
            images: [{
              name: "train",
              version: "latest",
              address: "registry.internal/team/train:latest",
              // The platform has been observed returning this stale label even
              // though the result came from the private catalogue filter.
              source: "SOURCE_PUBLIC",
              status: "READY",
            }],
          },
        };
      }
      return { data: { images: [] } };
    }
    throw new Error(`Unexpected path: ${path}`);
  }
}

describe("submission payload", () => {
  test("resolves names and builds CreateJobConsole payload", async () => {
    const payload = await buildSubmissionPayload(new FakeClient() as InspireClient, {
      name: "train-a",
      command: "python -c 'raise SystemExit(7)'",
      project: "示例项目",
      group: "H200训练区",
      gpus: 4,
      nodes: 3,
      image: "train:latest",
      maxTimeHours: 1.5,
      excludeNodes: ["node-1"],
    }, { ...DEFAULT_APP_CONFIG, workspace: "训练空间", nodes: 2 });

    expect(payload.workspace_id).toBe("ws-1");
    expect(payload.project_id).toBe("project-1");
    expect(payload.logic_compute_group_id).toBe("lcg-1");
    expect(payload.task_priority).toBe(7);
    expect(payload.exclude_nodes).toEqual(["node-1"]);
    expect(payload.max_running_time_ms).toBe("5400000");
    const config = (payload.framework_config as Record<string, unknown>[])[0]!;
    expect(config.instance_count).toBe(3);
    expect(config.image).toBe("registry.internal/team/train:latest");
    expect(config.image_type).toBe("SOURCE_PRIVATE");
    expect((config.resource_spec_price as Record<string, unknown>).quota_id).toBe("quota-1");
  });
});
