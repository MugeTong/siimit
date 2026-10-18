import type { Command, CommandContext } from "./types";
import { groupsApi } from "@/api";
import { prettyPrint } from "@/utils";

async function groupsHandler(ctx: CommandContext): Promise<void> {
  // Fetch the group list from the API
  const data = await groupsApi.listGroups();

  // Handle the results for better display
  const results = data.map((group) => ({
    ...group,
  }));

  prettyPrint(results, ctx.flags.has("--json"), [
    "groupId",
    "name",
    "free",
    "lowPriUsed",
    "gpuTotal",
  ]);
}

export const groupsCommand: Command = {
  name: "groups",
  hidden: false,
  short: "list available groups",
  description: "List all available groups and their usage.",
  aliases: [],
  positionalNames: [],
  valueOptions: {},
  flagOptions: {
    "--json": "output the results in JSON format",
  },
  run: groupsHandler,
};
