import { describe, expect, test } from "bun:test";

import type { InspireClient } from "../src/platform/client";
import { listCurrentUserJobs, renderJobs } from "../src/domain/jobs";

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

  test("paginates beyond the platform page-size limit", async () => {
    class PaginatedClient extends FakeClient {
      calls: Array<{ page: number; pageSize: number }> = [];

      override async postJson(
        path: string,
        body: Record<string, unknown>,
      ): Promise<Record<string, unknown>> {
        expect(path).toContain("Action=ListJobs");
        const page = Number(body.page_num);
        const pageSize = Number(body.page_size);
        this.calls.push({ page, pageSize });
        const start = (page - 1) * 100;
        const count = Math.min(pageSize, 250 - start);
        return {
          Result: {
            total: 250,
            jobs: Array.from({ length: count }, (_, offset) => ({
              job_id: `job-${start + offset}`,
              name: `train-${start + offset}`,
              status: "job_succeeded",
              created_at: String(1_000 + start + offset),
              framework_config: [],
            })),
          },
        };
      }
    }

    const client = new PaginatedClient();
    const rows = await listCurrentUserJobs(client as unknown as InspireClient, {
      limit: 150,
    });
    expect(client.calls).toEqual([
      { page: 1, pageSize: 100 },
      { page: 2, pageSize: 100 },
    ]);
    expect(rows).toHaveLength(150);
  });

  test("loads every page when no limit is supplied", async () => {
    class AllJobsClient extends FakeClient {
      calls = 0;

      override async postJson(): Promise<Record<string, unknown>> {
        this.calls += 1;
        const start = (this.calls - 1) * 100;
        const count = Math.min(100, 205 - start);
        return {
          Result: {
            total: 205,
            jobs: Array.from({ length: count }, (_, offset) => ({
              job_id: `job-${start + offset}`,
              created_at: String(start + offset + 1),
            })),
          },
        };
      }
    }

    const client = new AllJobsClient();
    const rows = await listCurrentUserJobs(client as unknown as InspireClient, {});
    expect(client.calls).toBe(3);
    expect(rows).toHaveLength(205);
  });
});
