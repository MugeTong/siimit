import { describe, expect, test } from "bun:test";

import { positional } from "../src/commands/args";

describe("positional", () => {
  test("skips option values regardless of argument order", () => {
    expect(positional(
      ["--for", "running", "job-test", "--timeout", "2h"],
      ["--for", "--timeout"],
    )).toBe("job-test");
  });
});
