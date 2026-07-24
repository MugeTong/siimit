import type { InspireClient } from "../platform/client";
import { ConfigurationError } from "../errors";
import { getTrainJob, removeTrainJob, stopTrainJob } from "../platform/train";
import { renderTable } from "../shared/table";
import { displayTime, normalizeTime } from "../shared/time";
import { asRecord as record, records as arrayOfRecords } from "../shared/records";
import { formatFrameworkResource } from "../shared/resource";

export interface JobDetail {
  jobId: string;
  name: string;
  status: string;
  project: string;
  resource: string;
  taskPriority: number | null;
  priorityLevel: string;
  shmGiB: number | "platform_default" | null;
  createdAt: string;
  createdAtMs: number | null;
  startedAt: string;
  finishedAt: string;
  platformRunningTime: string;
  exitCode: number | null;
  failureReason: string | null;
  node: string | null;
  raw: Record<string, unknown>;
}

export function validateJobId(value: string | undefined): string {
  const jobId = String(value ?? "").trim();
  if (!jobId.startsWith("job-") || jobId.length <= 4) {
    throw new ConfigurationError(
      "A complete job-... ID is required. Run 'siimit ls' to find a job ID.",
    );
  }
  return jobId;
}

export async function cancelJob(
  client: InspireClient,
  jobId: string,
): Promise<Record<string, unknown>> {
  return stopTrainJob(client, jobId);
}

export async function removeJob(
  client: InspireClient,
  jobId: string,
): Promise<Record<string, unknown>> {
  return removeTrainJob(client, jobId);
}

export async function getJob(client: InspireClient, jobId: string): Promise<JobDetail> {
  const raw = await getTrainJob(client, jobId);
  const framework = arrayOfRecords(raw.framework_config)[0] ?? {};
  const created = normalizeTime(raw.created_at);
  const submittedPriority = integer(raw.task_priority);
  const namedPriority = integer(raw.priority_name);
  const shm = Number(framework.shm_gi);
  const timeline = record(raw.timeline) ?? {};
  const started = normalizeTime(timeline.run ?? raw.started_at);
  const finished = normalizeTime(timeline.finished ?? raw.finished_at);
  const runningMilliseconds = Number(raw.running_time_ms ?? 0);
  const nodeInfo = arrayOfRecords(raw.node_infos)[0];
  const exitCode = nullableInteger(raw.exit_code ?? nodeInfo?.exit_code);
  const failureReason = nullableString(raw.failure_reason ?? raw.failed_reason ?? nodeInfo?.failure_reason);
  return {
    jobId: String(raw.job_id ?? raw.id ?? jobId),
    name: String(raw.name ?? ""),
    status: String(raw.status ?? "UNKNOWN").replace(/^job_/, "").toUpperCase(),
    project: String(raw.project_name ?? raw.project_id ?? ""),
    resource: formatFrameworkResource(framework),
    taskPriority: submittedPriority > 0 ? submittedPriority : namedPriority > 0 ? namedPriority : null,
    priorityLevel: String(raw.priority_level ?? ""),
    shmGiB: Number.isFinite(shm) ? (shm === 0 ? "platform_default" : shm) : null,
    createdAt: created.iso,
    createdAtMs: created.milliseconds,
    startedAt: started.iso,
    finishedAt: finished.iso,
    platformRunningTime: formatDuration(runningMilliseconds),
    exitCode,
    failureReason,
    node: nullableString(nodeInfo?.node_name ?? nodeInfo?.name),
    raw,
  };
}

export function renderJob(job: JobDetail): string {
  const headers = ["ID", "NAME", "STATUS"];
  const values = [job.jobId, job.name, job.status];
  if (job.exitCode !== null) {
    headers.push("EXIT");
    values.push(String(job.exitCode));
  }
  headers.push("PRIORITY", "PROJECT", "RESOURCE", "CREATED");
  values.push(job.taskPriority == null ? "-" : String(job.taskPriority), job.project, job.resource, displayTime(job.createdAt));
  return renderTable(
    headers,
    [values],
    { wide: true },
  );
}

function integer(value: unknown): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : 0;
}

function nullableInteger(value: unknown): number | null {
  const parsed = Number(value);
  return value !== undefined && value !== null && Number.isInteger(parsed) ? parsed : null;
}

function nullableString(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function formatDuration(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "00:00:00";
  const seconds = Math.floor(value / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return [hours, minutes, seconds % 60].map((part) => String(part).padStart(2, "0")).join(":");
}
