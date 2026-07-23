#!/usr/bin/env bun
import { commands } from "./commands";
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

  // Fetch the command constructor from the commands map and execute it
  const CommandCtor = commands[command];
  if (!CommandCtor) throw new SiimitError(`Unknown command: ${command}`);
  await new CommandCtor().handle(rest);

} catch (error: unknown) {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
