import { describe, expect, test } from "bun:test";

import { DEFAULT_APP_CONFIG } from "../src/config";
import { listVisibleImages, renderImages } from "../src/domain/images";
import type { InspireClient } from "../src/platform/client";

class FakeClient {
  async getJson(): Promise<Record<string, unknown>> {
    return {
      data: {
        routes: [{ name: "userWorkspaceList", routes: [{ name: "分布式训练空间", path: "ws-1" }] }],
      },
    };
  }

  async postJson(path: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
    expect(path).toBe("/api/v1/image/list");
    const filter = body.filter as Record<string, unknown>;
    expect(filter.visibility).toBe("VISIBILITY_PRIVATE");
    expect(filter.registry_hint).toEqual({ workspace_id: "ws-1" });
    return {
      data: {
        images: [{
          name: "ubuntu25.04-product",
          version: "1.0.1",
          address: "registry.internal/ubuntu25.04-product:1.0.1",
          status: "READY",
          source: "SOURCE_PUBLIC",
        }],
      },
    };
  }
}

describe("private images", () => {
  test("lists the same normalized private catalogue used by submission", async () => {
    const images = await listVisibleImages(new FakeClient() as unknown as InspireClient, DEFAULT_APP_CONFIG);
    expect(images).toEqual([{
      image: "ubuntu25.04-product:1.0.1",
      address: "registry.internal/ubuntu25.04-product:1.0.1",
      status: "READY",
    }]);
    expect(renderImages(images)).toContain("ubuntu25.04-product:1.0.1");
  });
});
