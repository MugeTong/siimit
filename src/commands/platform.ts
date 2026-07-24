import { loadAppConfig } from "../config";
import { listGroups, renderGroups } from "../domain/groups";
import { listVisibleImages, renderImages } from "../domain/images";
import { listParticipatingProjects, renderProjects } from "../domain/projects";
import type { Command } from "./command";
import { option } from "./args";
import { withClient } from "./runtime";

export const groupsCommand: Command = {
  name: "groups",
  short: "show GPU groups and availability",
  description: "Show GPU compute groups in the configured workspace.",
  usage: "siimit groups [--project PROJECT] [--wide | --json]",
  valueOptions: ["--project", "-p"],
  flagOptions: ["--wide", "--json"],
  conflicts: [["--wide", "--json"]],
  details: [
    "Options:",
    "  -p, --project PROJECT   Show GPU sizes allowed for this project",
    "      --wide              Do not truncate names or IDs",
    "      --json              Print structured JSON",
    "  -h, --help              Show this help",
    "",
    "Without --project, GPU SIZES is unavailable because allowed sizes depend on the project.",
  ].join("\n"),
  async run(args) {
    const config = await loadAppConfig();
    const project = option(args, "--project") ?? option(args, "-p");
    const rows = await withClient((client) => listGroups(client, config.workspace, project));
    if (args.includes("--json")) console.log(JSON.stringify(rows, null, 2));
    else {
      console.log(renderGroups(rows, config.workspace, args.includes("--wide")));
      if (!project) console.log("\nTip: use --project PROJECT to show allowed GPU sizes.");
    }
  },
};

export const imagesCommand: Command = {
  name: "images",
  short: "list personal private images",
  description: "List personal private images visible in the configured workspace.",
  usage: "siimit images [--wide | --json]",
  flagOptions: ["--wide", "--json"],
  conflicts: [["--wide", "--json"]],
  details: [
    "Options:",
    "  --wide       Print complete, copyable image addresses",
    "  --json       Print structured JSON",
    "  -h, --help   Show this help",
    "",
    "Use the IMAGE value or full ADDRESS as --image when submitting.",
  ].join("\n"),
  async run(args) {
    const config = await loadAppConfig();
    const images = await withClient((client) => listVisibleImages(client, config));
    console.log(args.includes("--json")
      ? JSON.stringify(images, null, 2)
      : renderImages(images, args.includes("--wide")));
  },
};

export const projectsCommand: Command = {
  name: "projects",
  short: "list participating projects",
  description: "List projects, available priorities, and point balances.",
  usage: "siimit projects [--wide | --json]",
  flagOptions: ["--wide", "--json"],
  conflicts: [["--wide", "--json"]],
  details: [
    "Options:",
    "  --wide       Print complete, copyable project names and IDs",
    "  --json       Print structured JSON",
    "  -h, --help   Show this help",
    "",
    "PRIORITIES shows whether low, or both low and high, may be requested.",
  ].join("\n"),
  async run(args) {
    const rows = await withClient(listParticipatingProjects);
    console.log(args.includes("--json")
      ? JSON.stringify(rows, null, 2)
      : renderProjects(rows, args.includes("--wide")));
  },
};
