import { describe, expect, test } from "bun:test";

import { DEFAULT_APP_CONFIG } from "../src/config";
import { listVisibleImages, renderImages } from "../src/domain/images";
import type { InspireClient } from "../src/platform/client";

class FakeClient {
  async postJson(path: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (path.includes("Action=ListWorkspaces")) {
      return { Result: { items: [{ name: "分布式训练空间", id: "ws-1" }] } };
    }
    expect(path).toBe("/api/v2/image?Action=ListImages");
    const filter = body.filter as Record<string, unknown>;
    expect(filter.visibility).toBe("VISIBILITY_PRIVATE");
    expect(filter.registry_hint).toEqual({ workspace_id: "ws-1" });
    return {
      Result: {
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
