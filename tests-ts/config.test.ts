import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { loadAppConfig } from "../src/config";

const directories: string[] = [];
afterEach(async () => Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true, force: true }))));

describe("configuration storage", () => {
  test("creates editable business defaults", async () => {
    const directory = await mkdtemp(join(tmpdir(), "siimit-"));
    directories.push(directory);
    const path = join(directory, "config.json");
    const config = await loadAppConfig(path);
    expect(config.workspace).toBe("分布式训练空间");
    expect(config.nodes).toBe(1);
    expect(Object.keys(config).sort()).toEqual([
      "framework",
      "nodes",
      "workspace",
    ]);
  });

});
