import { discoveryApi } from "@/api/discovery";
import type { Command, CommandContext } from "./types";
import { jobsApi } from "@/api";
import { parseInteger, prettyPrint } from "@/utils";
import { isJobStatus, JOB_STATUSES } from "@/types";

async function listHandler(ctx: CommandContext): Promise<void> {
  // Parameter validation
  let limit;
  if (ctx.params["--limit"]) {
    limit = parseInteger(ctx.params["--limit"]);
    if (!limit) {
      throw new Error(
        `Limit must be an integer, got '${ctx.params["--limit"]}'`,
      );
    }
    if (limit < 1 || limit > 5000) {
      throw new Error("Job limit must be between 1 and 5000");
    }
  }

  let status;
  if (ctx.params["--status"]) {
    if (!isJobStatus(ctx.params["--status"])) {
      throw new Error(`Invalid job status: '${ctx.params["--status"]}'`);
    }
    status = ctx.params["--status"];
  }

  // Fetch the job list from the API
  const data = await jobsApi.listJobs({
    keyword: ctx.params["--keyword"],
    status: status,
    limit: limit,
  });

  // Handle the results for better display
  const results = data.map((job) => ({
    ...job,
    status: job.status.toUpperCase(),
    created_at: new Date(job.created_at).toLocaleString("sv-SE", {
      timeZone: "Asia/Shanghai",
    }),
  }));

  // Output the results
  prettyPrint(results, ctx.flags.has("--json"), [
    "job_id",
    "name",
    "status",
    "logic_compute_group_name",
    "created_at",
  ]);
}

export const listCommand: Command = {
  name: "list",
  hidden: false,
  short: "list job queues",
  description: "List all job queues and their statuses.",
  aliases: ["ls"],
  positionalNames: [],
  valueOptions: {
    "--limit": "number of jobs displayed (default: 10)",
    "--keyword": "filter by a keyword in name",
    "--status": `filter by status: ${JOB_STATUSES.join(", ")}`,
  },
  flagOptions: {
    "--json": "output the results in JSON format",
  },
  run: listHandler,
};
