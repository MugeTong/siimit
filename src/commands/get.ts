import type { Command, CommandContext } from "./types";
import { jobsApi } from "@/api";
import { parseInteger, prettyPrint } from "@/utils";
import { isJobStatus, JOB_STATUSES } from "@/types";

async function listHandler(ctx: CommandContext): Promise<void> {
  // Parameter validation
  if (!ctx.args[0]) {
    throw new Error("Job ID is required");
  }

  const data = await jobsApi.getJob(ctx.args[0]);

  // Handle the results for better display
  const result = {
    ...data,
    status: data.status.toUpperCase(),
    createdAt: new Date(data.createdAt).toLocaleString("sv-SE", {
      timeZone: "Asia/Shanghai",
    }),
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
  positionalNames: ["<jobId>"],
  valueOptions: {},
  flagOptions: {
    "--json": "Output in JSON format",
  },
  run: listHandler,
};
