import { access } from "node:fs/promises";
import { loadAppConfig } from "../config";
import { cancelJob, getJob, removeJob, renderJob, validateJobId } from "../domain/job-actions";
import { listCurrentUserJobs, renderJobs } from "../domain/jobs";
import { buildSubmissionPayload } from "../domain/submission";
import { AuthenticationError, SiimitError } from "../errors";
import { InspireClient } from "../platform/client";
import { createTrainJob } from "../platform/train";
import { firstFramework, formatFrameworkResource } from "../shared/resource";
import { option, parseSubmitOptions, positiveIntegerOption } from "./args";
import type { Command } from "./command";
import { loginWithSavedCredentials, sessionOrLogin, withClient } from "./runtime";
import { confirm } from "./prompts";

export const listCommand: Command = {
  name: "ls",
  short: "list training jobs",
  description: "List the current user's training jobs across accessible workspaces.",
  usage: "siimit ls [--workspace NAME] [--status STATUS] [--keyword TEXT] [--limit NUMBER | --all] [--wide | --json]",
  valueOptions: ["--workspace", "--status", "--keyword", "--limit"],
  flagOptions: ["--all", "--wide", "--json"],
  conflicts: [["--limit", "--all"], ["--wide", "--json"]],
  details: [
    "Options:",
    "  --workspace NAME   Restrict results to one exact workspace name or ws-... ID",
    "  --status STATUS    RUNNING, QUEUING, SUCCEEDED, FAILED, CANCELLED, or API value",
    "  --keyword TEXT     Server-side name keyword filter",
    "  --limit NUMBER     Maximum rows after merging workspaces; automatically paginated (default: 20)",
    "  --all              Load all matching jobs across accessible workspaces",
    "  --wide             Do not truncate names or IDs",
    "  --json             Print structured JSON",
    "  -h, --help         Show this help",
  ].join("\n"),
  async run(args) {
    const options = {
      ...(option(args, "--workspace") ? { workspace: option(args, "--workspace")! } : {}),
      ...(option(args, "--status") ? { status: option(args, "--status")! } : {}),
      ...(option(args, "--keyword") ? { keyword: option(args, "--keyword")! } : {}),
      ...(args.includes("--all")
        ? {}
        : { limit: positiveIntegerOption(args, "--limit", 20) }),
    };
    const rows = await withClient((client) => listCurrentUserJobs(client, options));
    console.log(args.includes("--json")
      ? JSON.stringify(rows, null, 2)
      : renderJobs(rows, args.includes("--wide")));
  },
};

export const getCommand: Command = {
  name: "get",
  short: "show one training job",
  description: "Show normalized task state, or the complete platform response with --raw.",
  usage: "siimit get <job-id> [--json | --raw]",
  flagOptions: ["--json", "--raw"],
  conflicts: [["--json", "--raw"]],
  maxPositionals: 1,
  details: [
    "Options:",
    "  --json       Print normalized structured fields",
    "  --raw        Print the complete unnormalized platform response",
    "  -h, --help   Show this help",
    "",
    "Use --raw only for debugging; it may include verbose platform metadata.",
  ].join("\n"),
  async run(args) {
    const job = await withClient((client) => getJob(client, validateJobId(args.find((argument) => !argument.startsWith("-")))));
    if (args.includes("--raw")) return emit(job.raw);
    if (!args.includes("--json")) return console.log(renderJob(job));
    emit({
      jobId: job.jobId,
      name: job.name,
      status: job.status,
      project: job.project,
      resource: job.resource,
      task_priority: job.taskPriority,
      priority_level: job.priorityLevel,
      shm_gi: job.shmGiB,
      createdAt: job.createdAt,
      createdAtMs: job.createdAtMs,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      platformRunningTime: job.platformRunningTime,
      exit_code: job.exitCode,
      failure_reason: job.failureReason,
      node: job.node,
    });
  },
};

export const cancelCommand: Command = mutationCommand(
  "cancel",
  "request cancellation of a running or queued job",
  "Request cancellation of a running or queued training job.",
  async (jobId) => {
    await withClient((client) => cancelJob(client, jobId));
    return { cancel_requested: true, job_id: jobId };
  },
);

export const removeCommand: Command = mutationCommand(
  "remove",
  "delete a training job record",
  "Permanently delete a stopped or completed training job record.",
  async (jobId) => ({ removed: true, job_id: jobId, ...await withClient((client) => removeJob(client, jobId)) }),
);

export const submitCommand: Command = {
  name: "submit",
  short: "submit a GPU training job",
  description: "Resolve and submit a GPU training job, or validate it with --dry-run.",
  usage: "siimit submit [OPTIONS]",
  valueOptions: [
    "--name", "-n", "--command", "-c", "--command-file", "--project", "-p",
    "--group", "--gpus", "--nodes", "--image", "--max-time", "--priority",
    "--shm-size", "--exclude-node",
  ],
  flagOptions: ["--dry-run", "--json", "--yes"],
  details: [
    "Required:",
    "  -n, --name NAME          Job name",
    "  -c, --command COMMAND    Short inline start command",
    "      --command-file PATH  Absolute shared script path instead of --command",
    "  -p, --project PROJECT    Exact project name or project-... ID",
    "      --group GROUP        Exact GPU group name or lcg-... ID",
    "      --gpus NUMBER        GPUs per node",
    "      --image IMAGE        Private NAME:VERSION or full image address",
    "      --max-time HOURS     Maximum runtime; must be greater than zero",
    "",
    "Optional:",
    "      --priority LEVEL     low or high; defaults to highest available",
    "      --nodes NUMBER       Node count (default from config: 1)",
    "      --shm-size GIB       Shared memory per node; must be greater than zero",
    "      --exclude-node NAME  Exclude a node; repeat as needed",
    "      --dry-run            Resolve and validate without submitting",
    "      --json               Print structured JSON; with --dry-run, include the complete payload",
    "      --yes                Submit without interactive confirmation",
    "  -h, --help               Show this help",
    "",
    "Example:",
    "  siimit submit \\",
    "    --name hello \\",
    "    --command 'nvidia-smi' \\",
    "    --project PROJECT \\",
    "    --group GROUP \\",
    "    --gpus 1 \\",
    "    --image IMAGE \\",
    "    --max-time 1 \\",
    "    --dry-run",
    "",
    "Before submitting, copy values from:",
    "  siimit projects --wide",
    "  siimit groups --project PROJECT --wide",
    "  siimit images --wide",
    "",
    "Use --command for short commands and --command-file for training scripts or complex shell logic.",
    "Total GPUs = --gpus × --nodes.",
  ].join("\n"),
  async run(args) {
    const options = parseSubmitOptions(args);
    const commandFile = option(args, "--command-file");
    if (commandFile) await access(commandFile);
    const config = await loadAppConfig();
    let client = new InspireClient(await sessionOrLogin());
    let payload: Record<string, unknown>;
    try {
      payload = await buildSubmissionPayload(client, options, config);
    } catch (error) {
      if (!(error instanceof AuthenticationError)) throw error;
      client = new InspireClient(await loginWithSavedCredentials());
      payload = await buildSubmissionPayload(client, options, config);
    }
    if (args.includes("--dry-run")) {
      if (args.includes("--json")) return emit({ dry_run: true, payload });
      console.log(dryRunSummary(options, payload));
      return;
    }
    if (!args.includes("--yes")) {
      console.log(submissionSummary(options, payload, "Ready to submit this job:"));
      if (!process.stdin.isTTY) {
        throw new SiimitError("Confirmation is required. Review with --dry-run, then pass --yes for non-interactive submission.");
      }
      if (!await confirm("Submit now?")) throw new SiimitError("Submission cancelled.");
    }
    const submission = await createTrainJob(client, payload);
    const framework = firstFramework(submission.result.framework_config) ?? firstFramework(payload.framework_config);
    const result = {
      submitted: true,
      job_id: submission.jobId ?? null,
      status: String(submission.result.status ?? "job_queuing").replace(/^job_/, "").toUpperCase(),
      resource: formatFrameworkResource(framework),
      priority: priorityLabel(payload.task_priority),
      task_priority: payload.task_priority,
    };
    if (args.includes("--json")) return emit(result);
    console.log(renderSubmitResult(result));
  },
};

function mutationCommand(
  name: "cancel" | "remove",
  short: string,
  description: string,
  mutate: (jobId: string) => Promise<Record<string, unknown>>,
): Command {
  return {
    name,
    short,
    description,
    usage: `siimit ${name} <job-id> [--json]`,
    flagOptions: ["--json"],
    maxPositionals: 1,
    details: [
      "The job ID must be the complete job-... identifier.",
      "",
      "Options:",
      "  --json       Print structured JSON",
      "  -h, --help   Show this help",
    ].join("\n"),
    async run(args) {
      const result = await mutate(validateJobId(args.find((argument) => !argument.startsWith("-"))));
      if (args.includes("--json")) return emit(result);
      console.log(renderMutationResult(name, result));
    },
  };
}

export function renderSubmitResult(result: {
  job_id: string | null;
  status: string;
  resource: string;
  priority: "low" | "high";
  task_priority: unknown;
}): string {
  return [
    `Submitted job ${result.job_id ?? "(platform did not return an ID)"}.`,
    `Status: ${result.status}`,
    `Resource: ${result.resource}`,
    `Priority: ${result.priority} (${String(result.task_priority)})`,
  ].join("\n");
}

export function renderMutationResult(
  name: "cancel" | "remove",
  result: Record<string, unknown>,
): string {
  const jobId = String(result.job_id ?? "");
  if (name === "cancel") return `Cancellation requested for job ${jobId}.`;
  if (result.already_absent === true) return `Job ${jobId} was already absent.`;
  return `Removed job ${jobId}.`;
}

function dryRunSummary(options: ReturnType<typeof parseSubmitOptions>, payload: Record<string, unknown>): string {
  return [
    submissionSummary(options, payload, "Dry run successful. No task was submitted."),
    "",
    "Use --dry-run --json to print the complete platform payload.",
  ].join("\n");
}

function submissionSummary(
  options: ReturnType<typeof parseSubmitOptions>,
  payload: Record<string, unknown>,
  heading: string,
): string {
  const framework = firstFramework(payload.framework_config) ?? {};
  const nodes = Number(framework.instance_count ?? 1);
  return [
    heading,
    `Project: ${options.project}`,
    `Group: ${options.group}`,
    `Resource: ${nodes > 1 ? `${nodes} nodes × ` : ""}${formatFrameworkResource(framework)}, ${Number(framework.cpu ?? 0)} CPU, ${Number(framework.mem_gi ?? 0)} GiB per node`,
    `Priority: ${priorityLabel(payload.task_priority)} (${String(payload.task_priority)})`,
    `Image: ${String(framework.image ?? options.image)}`,
    `Max time: ${options.maxTimeHours} hour(s)`,
    `Command: ${options.command}`,
  ].join("\n");
}

function priorityLabel(value: unknown): "low" | "high" {
  return Number(value) >= 4 ? "high" : "low";
}

function emit(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}
