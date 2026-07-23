import { afterEach, describe, expect, test } from "bun:test";

import { CookieHttpClient } from "../src/platform/http";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("HTTP errors", () => {
  test("adds endpoint and troubleshooting context to connection failures", async () => {
    globalThis.fetch = (() => Promise.reject(new Error("socket closed"))) as unknown as typeof fetch;
    await expect(new CookieHttpClient().get("https://platform.example.test/api/v1/user/detail"))
      .rejects.toThrow(
        "Cannot connect to Inspire at https://platform.example.test: socket closed. "
        + "Check INSPIRE_BASE_URL, network access, and proxy settings.",
      );
  });
});
