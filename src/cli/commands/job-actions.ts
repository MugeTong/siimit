import { cancelJob, getJob, removeJob, renderJob, validateJobId } from "../../domain/job-actions";
import { withMutationClient, withReadClient } from "../runtime";

export async function runCancel(args: string[]): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) {
    console.log("Usage: siimit cancel <job-id>\n\nStop a running or queued training job.");
    return;
  }
  const jobId = validateJobId(args[0]);
  const result = await withMutationClient((client) => cancelJob(client, jobId));
  emit({ cancelled: true, job_id: jobId, result });
}

export async function runRemove(args: string[]): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) {
    console.log("Usage: siimit remove <job-id>\n\nPermanently delete a stopped or completed training job record.");
    return;
  }
  const jobId = validateJobId(args[0]);
  const result = await withMutationClient((client) => removeJob(client, jobId));
  emit({ removed: true, job_id: jobId, ...result });
}

export async function runGet(args: string[]): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) {
    console.log("Usage: siimit get <job-id> [--json | --raw]\n\nShow normalized task state.\n\nOptions:\n  --json  Print normalized structured JSON\n  --raw   Print the complete unnormalized platform response\n  -h, --help  Show this help");
    return;
  }
  const jobId = validateJobId(args[0]);
  const job = await withReadClient((client) => getJob(client, jobId));
  if (args.includes("--raw")) return emit(job.raw);
  if (!args.includes("--json")) {
    console.log(renderJob(job));
    return;
  }
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
}

function emit(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}
