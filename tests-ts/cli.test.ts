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
    expect(result.stdout).toContain("reuse an existing Siimit session");
    expect(result.stdout).toContain("Run login only when");
  });

  test("submit reports all missing required options", () => {
    const result = run("submit");
    expect(result.exitCode).toBe(1);
    for (const option of ["--name", "--command or --command-file", "--project", "--group", "--gpus", "--image", "--max-time"]) {
      expect(result.stderr).toContain(option);
    }
  });

  test("submit rejects unknown options before contacting the platform", () => {
    const result = run("submit", "--gpu", "1");
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Unknown option for submit: --gpu");
  });

  test("submit identifies an option whose value is missing", () => {
    const result = run(
      "submit",
      "--name",
      "--command", "echo",
      "--project", "project",
      "--group", "group",
      "--gpus", "1",
      "--image", "image",
      "--max-time", "1",
      "--dry-run",
    );
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("--name requires a value.");
    expect(result.stderr).not.toContain("Unknown submit option: echo");
  });

  test("query commands reject misspelled options before contacting the platform", () => {
    const result = run("projects", "--jsoon");
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Unknown option for projects: --jsoon");
  });

  test("submit help explains discovery, safety, and priority defaults", () => {
    const result = run("submit", "--help");
    expect(result.stdout).toContain("siimit projects --wide");
    expect(result.stdout).toContain("siimit groups --project PROJECT --wide");
    expect(result.stdout).toContain("siimit images --wide");
    expect(result.stdout).toContain("--yes");
    expect(result.stdout).toContain("defaults to highest available");
  });

  test("top-level help includes a getting-started workflow", () => {
    const result = run("--help");
    expect(result.stdout).toContain("Getting started:");
    expect(result.stdout).toContain("groups --project PROJECT --wide");
    expect(result.stdout).toContain("Add --json for structured output");
    expect(result.stdout).toContain("does not start a background service");
  });

  test("getting-started help is self-contained in the binary", () => {
    const result = run("help", "getting-started");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("siimit projects --wide");
    expect(result.stdout).toContain("siimit groups --project PROJECT --wide");
    expect(result.stdout).toContain("--dry-run");
    expect(result.stdout).toContain("Automation must add --yes");
    expect(result.stdout).toContain("If it succeeds, do not run login again");
  });

  test("query help explains structured output", () => {
    for (const command of ["projects", "groups", "images", "ls", "get"]) {
      expect(run(command, "--help").stdout).toContain("--json");
    }
  });
});
