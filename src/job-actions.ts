import type { InspireClient } from "./platform/client";
import { ApiError, ConfigurationError } from "./errors";
import { renderTable } from "./table";
import { displayTime, normalizeTime } from "./time";
import { asRecord as record, records as arrayOfRecords } from "./shared/records";

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
  runningTime: string;
  exitCode: number | null;
  failureReason: string | null;
  node: string | null;
  raw: Record<string, unknown>;
}

export function validateJobId(value: string | undefined): string {
  const jobId = String(value ?? "").trim();
  if (!jobId.startsWith("job-") || jobId.length <= 4) {
    throw new ConfigurationError("A complete job-... ID is required.");
  }
  return jobId;
}

export async function cancelJob(
  client: InspireClient,
  jobId: string,
): Promise<Record<string, unknown>> {
  const response = await client.postJson(
    "/api/v2/train?Action=StopJob",
    { job_id: jobId },
  );
  const metadata = record(response.ResponseMetadata);
  const error = record(metadata?.Error);
  if (error) {
    throw new ApiError(
      `StopJob failed: ${String(error.Code ?? "Error")}: ${String(error.Message ?? "unknown error")}`,
    );
  }
  return record(response.Result) ?? record(response.data) ?? {};
}

export async function removeJob(
  client: InspireClient,
  jobId: string,
): Promise<Record<string, unknown>> {
  const response = await client.postJson(
    "/api/v1/train_job/delete",
    { job_id: jobId },
  );
  if (response.code !== undefined && Number(response.code) !== 0) {
    const message = String(response.message ?? response.code);
    if (/already deleted|already absent|not found/i.test(message)) {
      return { already_absent: true };
    }
    throw new ApiError(
      `Delete job failed: ${message}.`,
    );
  }
  return record(response.data) ?? {};
}

export async function getJob(client: InspireClient, jobId: string): Promise<JobDetail> {
  const response = await client.postJson(
    "/api/v2/train?Action=GetJob",
    { job_id: jobId },
  );
  const metadata = record(response.ResponseMetadata);
  const error = record(metadata?.Error);
  if (error) {
    throw new ApiError(
      `GetJob failed: ${String(error.Code ?? "Error")}: ${String(error.Message ?? "unknown error")}`,
    );
  }
  const raw = record(response.Result) ?? record(response.data) ?? {};
  const framework = arrayOfRecords(raw.framework_config)[0] ?? {};
  const gpuCount = Number(framework.gpu_count ?? raw.gpu_count ?? 0);
  const price = record(framework.instance_spec_price_info) ?? record(framework.resource_spec_price);
  const gpuInfo = record(price?.gpu_info);
  const gpuType = String(gpuInfo?.gpu_type_display ?? gpuInfo?.gpu_product_simple ?? price?.gpu_type ?? "GPU");
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
    resource: gpuCount > 0 ? `${gpuCount}x${gpuType}` : "CPU",
    taskPriority: submittedPriority > 0 ? submittedPriority : namedPriority > 0 ? namedPriority : null,
    priorityLevel: String(raw.priority_level ?? ""),
    shmGiB: Number.isFinite(shm) ? (shm === 0 ? "platform_default" : shm) : null,
    createdAt: created.iso,
    createdAtMs: created.milliseconds,
    startedAt: started.iso,
    finishedAt: finished.iso,
    runningTime: formatDuration(runningMilliseconds),
    exitCode,
    failureReason,
    node: nullableString(nodeInfo?.node_name ?? nodeInfo?.name),
    raw,
  };
}

export function renderJob(job: JobDetail): string {
  return renderTable(
    ["ID", "NAME", "STATUS", "EXIT", "PRIORITY", "PROJECT", "RESOURCE", "CREATED"],
    [[job.jobId, job.name, job.status, job.exitCode == null ? "-" : String(job.exitCode), job.taskPriority == null ? "-" : String(job.taskPriority), job.project, job.resource, displayTime(job.createdAt)]],
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
