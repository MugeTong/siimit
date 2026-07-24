import { appConfigPath, loadAppConfig } from "../config";
import { SiimitError } from "../errors";
import type { Command } from "./command";

export const configCommand: Command = {
  name: "config",
  short: "show resolved configuration",
  description: "Show the configuration path or resolved non-secret settings.",
  usage: "siimit config [path|show]",
  maxPositionals: 1,
  details: [
    "Actions:",
    "  path   Print the config.json path",
    "  show   Print the resolved workspace, node count, and framework",
    "  -h, --help   Show this help",
    "",
    "The configuration normally lives at ~/.config/siimit/config.json.",
  ].join("\n"),
  async run(args) {
    if (args[0] === "path") return console.log(appConfigPath());
    if (args[0] === undefined || args[0] === "show") {
      return console.log(JSON.stringify(await loadAppConfig(), null, 2));
    }
    throw new SiimitError(
      `Unknown config action: ${args[0]}. Run 'siimit config --help' for usage.`,
    );
  },
};
