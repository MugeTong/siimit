import type { Command, CommandContext } from "./types";
import { jobsApi } from "@/api";

async function deleteHandler(ctx: CommandContext): Promise<void> {
  const jobId: string = ctx.args[0]!;
  await jobsApi.deleteJob(jobId);

  console.log(`Job ${jobId} deleted successfully.`);
}

export const deleteCommand: Command = {
  name: "delete",
  hidden: false,
  short: "delete a job by ID",
  description: "Delete a job by its ID.",
  aliases: ["remove"],
  positionalNames: ["<job-id>"],
  valueOptions: {},
  flagOptions: {},
  run: deleteHandler,
};
