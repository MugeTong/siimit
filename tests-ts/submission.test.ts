import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import type { InspireClient } from "../src/platform/client";
import { buildSubmissionPayload } from "../src/submission";
import { buildLoggedCommand, expandLogFileTemplate, extractLogFile } from "../src/logging/wrapper";
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
      excludeNodes: ["node-1"],
    }, { ...DEFAULT_APP_CONFIG, workspace: "训练空间", nodes: 2 });

    expect(payload.workspace_id).toBe("ws-1");
    expect(payload.project_id).toBe("project-1");
    expect(payload.logic_compute_group_id).toBe("lcg-1");
    expect(payload.task_priority).toBe(7);
    expect(payload.exclude_nodes).toEqual(["node-1"]);
    const config = (payload.framework_config as Record<string, unknown>[])[0]!;
    expect(config.instance_count).toBe(3);
    expect(config.image).toBe("registry.internal/team/train:latest");
    expect(config.image_type).toBe("SOURCE_PRIVATE");
    expect((config.resource_spec_price as Record<string, unknown>).quota_id).toBe("quota-1");
  });

  test("expands log templates deterministically", () => {
    expect(expandLogFileTemplate(
      "runs/{name}-{timestamp}.log",
      "densecat",
      new Date("2026-07-14T12:13:30Z"),
    )).toBe("runs/densecat-2026-07-14T12-13-30.000Z.log");
  });

  test("logs with one generated shell command and preserves exit status", async () => {
    const directory = await mkdtemp(join(tmpdir(), "siimit log "));
    const logFile = join(directory, "nested dir", "task.log");
    try {
      const firstCommand = buildLoggedCommand(logFile, "printf 'first\\n'; exit 7", false);
      const first = Bun.spawnSync(["bash", "-c", firstCommand]);
      expect(first.exitCode).toBe(7);
      expect(await readFile(logFile, "utf8")).toBe("first\n");
      expect(extractLogFile(firstCommand)).toBe(logFile);
      expect(extractLogFile(`bash -c 'wrapper' siimit-wrapper '/shared/legacy.log' 'echo ok'`))
        .toBe("/shared/legacy.log");
      expect(extractLogFile(`bash '/shared/logs/.siimit/wrappers/legacy.log.sh'`))
        .toBe("/shared/logs/legacy.log");

      const secondCommand = buildLoggedCommand(logFile, "printf 'second\\n'", true);
      const second = Bun.spawnSync(["bash", "-c", secondCommand]);
      expect(second.exitCode).toBe(0);
      expect(await readFile(logFile, "utf8")).toBe("first\nsecond\n");
      expect(await Array.fromAsync(new Bun.Glob("**/.siimit/**").scan({ cwd: directory }))).toEqual([]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
