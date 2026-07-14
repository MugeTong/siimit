#!/usr/bin/env bun
import packageInfo from "../package.json";
import { runLogin, runLogout } from "./cli/commands/auth";
import { runConfig } from "./cli/commands/config";
import { runGroups } from "./cli/commands/groups";
import { runImages } from "./cli/commands/images";
import { runCancel, runGet, runRemove } from "./cli/commands/job-actions";
import { runList } from "./cli/commands/jobs";
import { runProjects } from "./cli/commands/projects";
import { runSubmit } from "./cli/commands/submit";
import { printHelp } from "./cli/help";
import { SiimitError } from "./errors";

const commands: Record<string, (args: string[]) => void | Promise<void>> = {
  login: runLogin,
  logout: runLogout,
  config: runConfig,
  projects: runProjects,
  groups: runGroups,
  images: runImages,
  ls: runList,
  get: runGet,
  submit: runSubmit,
  cancel: runCancel,
  remove: runRemove,
};

async function main(args: string[]): Promise<void> {
  const [command, ...rest] = args;
  if (!command || command === "--help" || command === "-h") return printHelp(packageInfo.version);
  if (command === "--version" || command === "-V" || command === "version") {
    console.log(packageInfo.version);
    return;
  }
  const handler = commands[command];
  if (!handler) throw new SiimitError(`Unknown command: ${command}`);
  await handler(rest);
}

main(process.argv.slice(2)).catch((error: unknown) => {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
