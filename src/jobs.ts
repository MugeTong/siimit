import type { InspireClient } from "./platform/client";
import { ApiError, ConfigurationError } from "./errors";
import { listWorkspaces, resolveWorkspace } from "./platform/catalog/workspaces";
import { renderTable } from "./table";
import { displayTime, normalizeTime } from "./time";
import { asRecord as record, records as arrayOfRecords } from "./shared/records";
import { formatFrameworkResource } from "./shared/resource";

export interface ListOptions {
  workspace?: string;
  status?: string;
  keyword?: string;
  limit: number;
}

export interface JobRow {
  jobId: string;
  name: string;
  status: string;
  workspace: string;
  project: string;
  gpu: string;
  createdAt: string;
  createdAtMs: number | null;
}

const STATUS_ALIASES: Record<string, string> = {
  PENDING: "job_pending",
  RUNNING: "job_running",
  QUEUING: "job_queuing",
  SUCCEEDED: "job_succeeded",
  FAILED: "job_failed",
  CANCELLED: "job_cancelled",
};

export async function listCurrentUserJobs(
  client: InspireClient,
  options: ListOptions,
): Promise<JobRow[]> {
  const identity = await client.whoami();
  const userId = String(identity.id ?? identity.user_id ?? "");
  if (!userId) throw new ApiError("Current user response has no id.");

  const available = await listWorkspaces(client);
  const selected = options.workspace
    ? [await resolveWorkspace(client, options.workspace)]
    : available.map((item) => item.id);
  if (!selected.length) throw new ConfigurationError("No accessible workspaces were found.");
  const names = new Map(available.map((item) => [item.id, item.name]));
  const rows: JobRow[] = [];
  for (const workspaceId of selected) {
    const body: Record<string, unknown> = {
      workspace_id: workspaceId,
      page_num: 1,
      page_size: Math.min(Math.max(options.limit, 1), 100),
      created_by: userId,
    };
    if (options.keyword) body.keyword = options.keyword;
    if (options.status) body.status = normalizeStatus(options.status);
    const response = await client.postJson("/api/v2/train?Action=ListJobs", body);
    const metadata = record(response.ResponseMetadata);
    if (record(metadata?.Error)) {
      const error = record(metadata?.Error)!;
      throw new ApiError(`ListJobs failed: ${String(error.Code ?? "Error")}: ${String(error.Message ?? "unknown error")}`);
    }
    const result = record(response.Result) ?? record(response.data) ?? {};
    for (const job of arrayOfRecords(result.jobs)) {
      const framework = arrayOfRecords(job.framework_config)[0] ?? {};
      const created = normalizeTime(job.created_at);
      rows.push({
        jobId: String(job.job_id ?? job.id ?? ""),
        name: String(job.name ?? ""),
        status: displayStatus(String(job.status ?? "")),
        workspace: names.get(workspaceId) ?? workspaceId,
        project: String(job.project_name ?? job.project_id ?? ""),
        gpu: formatFrameworkResource(framework),
        createdAt: created.iso,
        createdAtMs: created.milliseconds,
      });
    }
  }
  return rows
    .sort((left, right) => (right.createdAtMs ?? 0) - (left.createdAtMs ?? 0))
    .slice(0, options.limit);
}

export function renderJobs(rows: JobRow[], wide = false): string {
  if (!rows.length) return "No jobs found.";
  const headers = ["ID", "NAME", "STATUS", "WORKSPACE", "PROJECT", "RESOURCE", "CREATED"];
  const values = rows.map((row) => [
    row.jobId,
    row.name,
    row.status,
    row.workspace,
    row.project,
    row.gpu,
    displayTime(row.createdAt),
  ]);
  return renderTable(headers, values, { wide });
}

function normalizeStatus(value: string): string {
  return value.startsWith("job_") ? value : STATUS_ALIASES[value.toUpperCase()] ?? value;
}

function displayStatus(value: string): string {
  return value.replace(/^job_/, "").toUpperCase();
}
