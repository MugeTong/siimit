#!/usr/bin/env bun
import { commands } from "./commands";
import { execute } from "./commands/command";
import { SiimitError } from "./errors";

try {
  const [arg, ...rest] = process.argv.slice(2);
  let command = arg ? arg : "help";

  // Handle --help and --version flags
  if (arg === "--help" || arg === "-h") {
    command = "help";
  }
  if (arg === "--version" || arg === "-V" || arg === "-v" || arg === "version") {
    command = "version";
  }

  const selected = commands[command];
  if (!selected) throw new SiimitError(`Unknown command: ${command}`);
  await execute(selected, rest);

} catch (error: unknown) {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
