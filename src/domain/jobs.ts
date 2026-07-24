import type { InspireClient } from "../platform/client";
import { ApiError, ConfigurationError } from "../errors";
import { listWorkspaces, resolveWorkspace } from "../platform/catalog/workspaces";
import { listTrainJobs } from "../platform/train";
import { renderTable } from "../shared/table";
import { displayTime, normalizeTime } from "../shared/time";
import { records as arrayOfRecords } from "../shared/records";
import { formatFrameworkResource } from "../shared/resource";

export interface ListOptions {
  workspace?: string;
  status?: string;
  keyword?: string;
  limit?: number;
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
    let page = 1;
    let fetched = 0;
    const pageSize = options.limit === undefined
      ? 100
      : Math.min(100, options.limit);
    while (options.limit === undefined || fetched < options.limit) {
      const body: Record<string, unknown> = {
        workspace_id: workspaceId,
        page_num: page,
        page_size: pageSize,
        created_by: userId,
      };
      if (options.keyword) body.keyword = options.keyword;
      if (options.status) body.status = normalizeStatus(options.status);
      const result = await listTrainJobs(client, body);
      const jobs = arrayOfRecords(result.jobs);
      for (const job of jobs) {
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
      fetched += jobs.length;
      const total = optionalNonNegativeInteger(result.total ?? result.total_count);
      if (
        jobs.length === 0 ||
        jobs.length < pageSize ||
        (total !== null && fetched >= total)
      ) break;
      page += 1;
    }
  }
  const sorted = rows
    .sort((left, right) => (right.createdAtMs ?? 0) - (left.createdAtMs ?? 0));
  return options.limit === undefined ? sorted : sorted.slice(0, options.limit);
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

function optionalNonNegativeInteger(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}
