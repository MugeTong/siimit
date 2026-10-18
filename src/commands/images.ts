import type { Command, CommandContext } from "./types";
import { imagesApi } from "@/api";
import { prettyPrint } from "@/utils";

async function imagesHandler(ctx: CommandContext): Promise<void> {
  // Fetch the image list from the API
  const data = await imagesApi.lsitImages();

  // Handle the results for better display
  const results = data.map((image) => ({
    ...image,
  }));

  prettyPrint(results, ctx.flags.has("--json"), ["name", "status"]);
}

export const imagesCommand: Command = {
  name: "images",
  hidden: false,
  short: "list available images",
  description: "List all available images and their statuses.",
  aliases: [],
  positionalNames: [],
  valueOptions: {},
  flagOptions: {
    "--json": "output the results in JSON format",
  },
  run: imagesHandler,
};
