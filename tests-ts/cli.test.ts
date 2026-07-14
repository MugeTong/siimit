import { describe, expect, test } from "bun:test";

function run(...args: string[]): { exitCode: number; stdout: string; stderr: string } {
  const result = Bun.spawnSync(["bun", "run", "src/index.ts", ...args], {
    cwd: process.cwd(),
    env: { ...process.env, INSPIRE_USERNAME: "", INSPIRE_PASSWORD: "" },
  });
  return {
    exitCode: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  };
}

describe("CLI onboarding", () => {
  test("login help is non-interactive", () => {
    const result = run("login", "--help");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Usage: siimit login");
    expect(result.stdout).not.toContain("Username:");
  });

  test("submit reports all missing required options", () => {
    const result = run("submit");
    expect(result.exitCode).toBe(1);
    for (const option of ["--name", "--command or --command-file", "--project", "--group", "--gpus", "--image", "--max-time"]) {
      expect(result.stderr).toContain(option);
    }
  });

  test("top-level help includes a getting-started workflow", () => {
    const result = run("--help");
    expect(result.stdout).toContain("Getting started:");
    expect(result.stdout).toContain("groups --project PROJECT --wide");
    expect(result.stdout).toContain("Add --json for structured output");
  });

  test("query help explains structured output", () => {
    for (const command of ["projects", "groups", "images", "ls", "get"]) {
      expect(run(command, "--help").stdout).toContain("--json");
    }
  });
});
