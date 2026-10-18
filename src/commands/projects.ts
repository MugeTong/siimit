import type { Command, CommandContext } from "./types";
import { projectsApi } from "@/api";
import { authStorage } from "@/storage";
import { prettyPrint } from "@/utils";

async function projectsHandler(ctx: CommandContext): Promise<void> {
  // Fetch the project list from the API
  const data = await projectsApi.getProjects();

  // Handle the results for better display
  const results = data.map((project) => ({
    ...project,
  }));

  prettyPrint(results, ctx.flags.has("--json"), ["id", "name", "priority", "remain", "myRemain"]);
}

export const projectsCommand: Command = {
  name: "projects",
  hidden: false,
  short: "list projects participated in",
  description: "List projects, available priorities, and point balances.",
  aliases: [],
  positionalNames: [],
  valueOptions: {},
  flagOptions: {
    "--json": "output the results in JSON format",
  },
  run: projectsHandler,
};
