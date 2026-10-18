import type { Command, CommandContext } from "./types";
import { groupsApi, jobsApi } from "@/api";
import { resolvePriority, PRIORITIES, type Priority } from "@/types";
import { parseInteger, prettyPrint } from "@/utils";

type TerminalValidationResult = {
  name: string;
  projectId: string;
  imageName: string;
  groupId: string;
  quotaId: string;
  priority: Priority;
  command?: string;
  commandFile?: string;
  maxTime: number;
  nodes: number;
};

async function validateParams(
  ctx: CommandContext,
): Promise<TerminalValidationResult> {
  const name = ctx.args[0]!;

  if (!ctx.params["--project"]) {
    throw new Error("Missing required parameter: --project");
  }
  const projectId = ctx.params["--project"];

  if (!ctx.params["--image"]) {
    throw new Error("Missing required parameter: --image");
  }
  const imageName = ctx.params["--image"];

  if (!ctx.params["--group"]) {
    throw new Error("Missing required parameter: --group");
  }
  const groupId = ctx.params["--group"];

  if (!ctx.params["--priority"]) {
    throw new Error("Missing required parameter: --priority");
  } else {
    if (!PRIORITIES.includes(ctx.params["--priority"] as Priority)) {
      throw new Error("Invalid priority value");
    }
  }
  const priority = resolvePriority(Number(ctx.params["--priority"]));

  if (!ctx.params["--command"] && !ctx.params["--command-file"]) {
    throw new Error(
      "Missing required parameter: either --command or --command-file must be provided",
    );
  }
  const command = ctx.params["--command"];
  const commandFile = ctx.params["--command-file"];

  if (!ctx.params["--gpus"]) {
    throw new Error("Missing required parameter: --gpus");
  }
  const gpus = parseInteger(ctx.params["--gpus"]);
  if (!gpus || gpus < 0) {
    throw new Error("Invalid value for --gpus, must be a non-negative integer");
  }
  // Detect if the gpus number is a valid option.
  const quotaMap: Record<number, string> = await groupsApi.getQuotaMap(
    groupId,
    priority,
  );
  if (!quotaMap[gpus]) {
    throw new Error(
      [
        `Invalid value for --gpus: ${gpus}. For`,
        `Group: ${groupId}, Priority: ${priority}`,
        `The available GPU counts are: ${Object.keys(quotaMap).join(", ")}`,
      ].join("\n"),
    );
  }
  const quotaId = quotaMap[gpus];

  if (!ctx.params["--max-time"]) {
    throw new Error("Missing required parameter: --max-time");
  }
  const factorMap: Record<string, number> = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
  };
  const timeUnit = ctx.params["--max-time"].slice(-1);
  const timeValue = ctx.params["--max-time"].slice(0, -1);
  if (!factorMap[timeUnit]) {
    throw new Error(
      "Invalid unit for --max-time, must end with 's', 'm', 'h', or 'd'",
    );
  }
  let time = parseInteger(timeValue);
  if (!time || time < 0) {
    throw new Error(
      "Invalid value for --max-time, must be a non-negative integer",
    );
  }
  const maxTime = time * factorMap[timeUnit];

  let nodes: number | undefined = 1; // default value
  if (ctx.params["--nodes"]) {
    nodes = parseInteger(ctx.params["--nodes"]);
    if (!nodes || nodes < 1) {
      throw new Error("Invalid value for --nodes, must be a positive integer");
    }
  }

  return {
    name,
    projectId,
    imageName,
    groupId,
    quotaId,
    priority,
    command,
    commandFile,
    maxTime,
    nodes,
  };
}

async function submitHandler(ctx: CommandContext): Promise<void> {
  const params = await validateParams(ctx);

  if (!ctx.flags.has("--yes")) {
    console.log(
      "Parameters validated successfully. Use the --yes flag to confirm submission.",
    );
    return;
  }

  const data = await jobsApi.submitJob({
    name: params.name,
    projectId: params.projectId,
    imageName: params.imageName,
    groupId: params.groupId,
    priority: params.priority,
    command: params.command,
    commandFile: params.commandFile,
    quotaId: params.quotaId,
    maxRunSeconds: params.maxTime,
    nodeCount: params.nodes,
  });

  // Handle the results for better display
  const results = {
    ...data,
    status: data.status.toUpperCase(),
  };

  // Output the results
  prettyPrint(results, ctx.flags.has("--json"), [
    "jobId",
    "name",
    "status",
    "priority",
  ]);
}

export const submitCommand: Command = {
  name: "submit",
  hidden: false,
  short: "submit a job",
  description: "Submit a job with the specified parameters.",
  aliases: ["create"],
  positionalNames: ["<job-name>"],
  valueOptions: {
    "--project": "project Id",
    "--image": "name of the image to use",
    "--group": "computation group Id",
    "--priority": "job priority level",
    "--command": "command to execute for the job",
    "--command-file": "path to a file to execute using bash",
    "--gpus": "number of GPUs per node: 1, 2, 4, 8",
    "--max-time": "maximum time to run (e.g. 60s, 10m, 2h, 1d)",
    "--nodes": "number of nodes used (default: 1)",
  },
  flagOptions: {
    "--json": "output in JSON format",
    "--yes": "job will be submitted only when this flag is set",
  },
  run: submitHandler,
};
