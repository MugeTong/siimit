import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  loadAppConfig,
  loadCredentials,
  loadSession,
  saveCredentials,
  saveSession,
} from "../src/config";

const directories: string[] = [];
afterEach(async () => Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true, force: true }))));

describe("session storage", () => {
  test("round-trips Python-compatible state with 0600 permissions", async () => {
    const directory = await mkdtemp(join(tmpdir(), "siimit-"));
    directories.push(directory);
    const path = join(directory, "session.json");
    await saveSession({ base_url: "https://example.test", username: "alice", created_at: 1, storage_state: { cookies: [{ name: "sid", value: "secret", path: "/" }], origins: [] } }, path);
    expect((await loadSession(path)).username).toBe("alice");
    expect((await stat(path)).mode & 0o777).toBe(0o600);
    expect(await readFile(path, "utf8")).not.toContain("password");
  });

  test("stores saved credentials with 0600 permissions", async () => {
    const directory = await mkdtemp(join(tmpdir(), "siimit-"));
    directories.push(directory);
    const path = join(directory, "credentials.json");
    await saveCredentials(
      { username: "alice", password: "secret", base_url: "https://example.test" },
      path,
    );
    expect((await loadCredentials(path)).username).toBe("alice");
    expect((await stat(path)).mode & 0o777).toBe(0o600);
  });

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
