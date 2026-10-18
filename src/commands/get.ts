import type { Command, CommandContext } from "./types";
import { jobsApi } from "@/api";
import { parseInteger, prettyPrint, timestamp2date } from "@/utils";
import { isJobStatus, JOB_STATUSES } from "@/types";

async function listHandler(ctx: CommandContext): Promise<void> {
  const jobId: string = ctx.args[0]!;
  const data = await jobsApi.getJob(jobId);

  // Handle the results for better display
  const result = {
    ...data,
    status: data.status.toUpperCase(),
    createdAt: timestamp2date(data.createdAt),
    finishedAt: data.finishedAt ? timestamp2date(data.finishedAt) : "N/A",
  };

  // Output the results
  prettyPrint(result, ctx.flags.has("--json"), [
    "jobId",
    "name",
    "status",
    "priority",
    "groupName",
    "createdAt",
    "finishedAt",
  ]);
}

export const getCommand: Command = {
  name: "get",
  hidden: false,
  short: "get job details by job ID",
  description: "Get job details by job ID.",
  aliases: [],
  positionalNames: ["<job-id>"],
  valueOptions: {},
  flagOptions: {
    "--json": "Output in JSON format",
  },
  run: listHandler,
};
