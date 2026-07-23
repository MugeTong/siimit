import stringWidth from "string-width";
import packageInfo from "../../package.json";
import type { Command } from "./command";
import { commandHelp } from "./command";
import { loginCommand, logoutCommand } from "./auth";
import { configCommand } from "./config";
import {
  cancelCommand,
  getCommand,
  listCommand,
  removeCommand,
  submitCommand,
} from "./jobs";
import { groupsCommand, imagesCommand, projectsCommand } from "./platform";

const versionCommand: Command = {
  name: "version",
  short: "show the version of Siimit",
  description: "Display the version number of Siimit.",
  usage: "siimit version | -v | -V | --version",
  maxPositionals: 0,
  run() {
    console.log(`siimit version ${packageInfo.version}`);
  },
};

const helpCommand: Command = {
  name: "help",
  short: "show help for a command",
  description: "Display detailed help information for a specific command.",
  usage: "siimit help <command>",
  maxPositionals: 1,
  run(args) {
    if (args[0] === "getting-started") {
      console.log(gettingStartedHelp());
      return;
    }
    if (args.length > 0) {
      const command = commands[args[0]!];
      console.log(command ? commandHelp(command) : `Unknown command: ${args[0]}`);
      return;
    }
    console.log("Siimit is a CLI for logging in and submitting training jobs.\n");
    console.log("Each invocation runs one command and exits; Siimit does not start a background service.\n");
    console.log("Usage: siimit <command> [options]\n");
    console.log("Available commands:");
    const width = Math.max(...Object.values(commands).map((command) => stringWidth(command.name)));
    for (const command of Object.values(commands)) {
      console.log(`  ${command.name}${" ".repeat(width - stringWidth(command.name) + 2)}${command.short}`);
    }
    console.log("\nGetting started:");
    console.log("  1. siimit projects --wide                         # reuses an existing login; copy PROJECT");
    console.log("     If prompted by an authentication error: siimit login, then retry.");
    console.log("  2. siimit groups --project PROJECT --wide         # copy GROUP and choose GPU count");
    console.log("  3. siimit images --wide                           # copy IMAGE");
    console.log("  4. siimit submit --help                           # copy the dry-run example");
    console.log("\nRun 'siimit help getting-started' for the complete workflow.");
    console.log("\nQuery commands print tables by default. Add --json for structured output.");
    console.log("\nUse 'siimit help <command>' or 'siimit <command> --help' for more information about that command.");
  },
};

function gettingStartedHelp(): string {
  return [
    "Getting started with Siimit",
    "",
    "1. Check whether this machine already has a reusable Siimit session:",
    "   siimit projects --wide",
    "",
    "   If it succeeds, do not run login again. Continue with the returned PROJECT.",
    "   If Siimit reports that no session or credentials are available, run:",
    "   siimit login",
    "   Then retry: siimit projects --wide",
    "",
    "2. Copy the full PROJECT name or project-... ID from the project list.",
    "",
    "3. Find a GPU group and an allowed per-node GPU count:",
    "   siimit groups --project PROJECT --wide",
    "",
    "4. Find a personal image. Copy NAME:VERSION or the full ADDRESS:",
    "   siimit images --wide",
    "",
    "5. Build and validate the command without creating a task:",
    "   siimit submit \\",
    "     --name hello \\",
    "     --command 'nvidia-smi' \\",
    "     --project PROJECT \\",
    "     --group GROUP \\",
    "     --gpus 1 \\",
    "     --image IMAGE \\",
    "     --max-time 1 \\",
    "     --dry-run",
    "",
    "6. Review every resolved value, then remove --dry-run to submit.",
    "   Interactive terminals ask for confirmation. Automation must add --yes.",
    "",
    "For every option, run: siimit submit --help",
  ].join("\n");
}

export const commands: Record<string, Command> = {
  version: versionCommand,
  help: helpCommand,
  login: loginCommand,
  logout: logoutCommand,
  config: configCommand,
  groups: groupsCommand,
  images: imagesCommand,
  projects: projectsCommand,
  ls: listCommand,
  get: getCommand,
  cancel: cancelCommand,
  remove: removeCommand,
  submit: submitCommand,
};
