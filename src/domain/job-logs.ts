import { ApiError } from "../errors";
import type { InspireClient } from "../platform/client";
import { asRecord as record, records } from "../shared/records";
import { normalizeTime } from "../shared/time";
import { getJob } from "./job-actions";

export type LogOrder = "asc" | "desc";

export interface ContainerLog {
  message: string;
  timestampMs: number | null;
  timestamp: string;
  podName: string;
  node: string;
  logId: string;
}

export interface JobEvent {
  type: string;
  reason: string;
  source: string;
  message: string;
  firstTimestamp: string;
  firstTimestampMs: number | null;
  lastTimestamp: string;
  lastTimestampMs: number | null;
  objectType: string;
  objectId: string;
}

export interface JobLogResult<T> {
  jobId: string;
  kind: "logs" | "events";
  order: LogOrder;
  total: number;
  items: T[];
}

export async function getContainerLogs(
  client: InspireClient,
  jobId: string,
  limit: number | undefined,
  order: LogOrder,
): Promise<JobLogResult<ContainerLog>> {
  const range = await jobLogRange(client, jobId);
  const items: ContainerLog[] = [];
  let total = 0;
  let searchAfter: [string, string] | undefined;

  while (limit === undefined || items.length < limit) {
    const pageSize = Math.min(1000, limit === undefined ? 1000 : limit - items.length);
    const response = await client.postJson("/api/v2/train?Action=GetJobLog", {
      page_size: pageSize,
      filter: {
        podNames: range.podNames,
        start_timestamp_ms: String(range.startMs),
        end_timestamp_ms: String(range.endMs),
      },
      sorter: [
        { field: "time", sort: sortName(order) },
        { field: "log-id.keyword", sort: sortName(order) },
      ],
      ...(searchAfter ? { search_after: searchAfter } : {}),
    });
    const result = apiResult(response, "GetJobLog");
    total = number(result.total);
    const page = records(result.logs);
    items.push(...page.map(containerLog));
    if (
      page.length === 0 ||
      items.length >= total ||
      (limit !== undefined && items.length >= limit)
    ) break;

    const last = page.at(-1) ?? {};
    const next: [string, string] = [String(last.time ?? ""), String(last.log_id ?? "")];
    if (!next[0] || !next[1] || sameCursor(searchAfter, next)) {
      throw new ApiError("GetJobLog pagination stopped because the platform returned no usable cursor.");
    }
    searchAfter = next;
  }

  return {
    jobId,
    kind: "logs",
    order,
    total,
    items,
  };
}

export async function getJobEvents(
  client: InspireClient,
  jobId: string,
  limit: number,
  order: LogOrder,
): Promise<JobLogResult<JobEvent>> {
  const range = await jobLogRange(client, jobId);
  const response = await client.postJson("/api/v2/train?Action=ListJobEvents", {
    page_num: 1,
    page_size: limit,
    filter: {
      object_type: "instance",
      object_ids: range.podNames,
      start_last_timestamp: String(Math.floor(range.startMs / 1000)),
      end_last_timestamp: String(Math.ceil(range.endMs / 1000)),
    },
    sorter: [{ field: "last_timestamp", sort: sortName(order) }],
  });
  const result = apiResult(response, "ListJobEvents");
  return {
    jobId,
    kind: "events",
    order,
    total: number(result.total),
    items: records(result.events).map(jobEvent),
  };
}

export function isPlatformHeartbeat(log: ContainerLog): boolean {
  return log.message === "wait done file (retry after 1 second)...";
}

async function jobLogRange(
  client: InspireClient,
  jobId: string,
): Promise<{ podNames: string[]; startMs: number; endMs: number }> {
  const job = await getJob(client, jobId);
  const framework = records(job.raw.framework_config)[0] ?? {};
  const instanceCount = Math.max(1, Math.trunc(number(framework.instance_count) || 1));
  const timeline = record(job.raw.timeline) ?? {};
  const startMs = number(job.raw.created_at ?? timeline.created);
  const endMs = number(job.raw.finished_at ?? timeline.finished) || Date.now();
  if (startMs <= 0) throw new ApiError("GetJob did not provide a valid creation time for log lookup.");
  return {
    podNames: Array.from({ length: instanceCount }, (_, index) => `${jobId}-worker-${index}`),
    startMs,
    endMs: Math.max(startMs, endMs),
  };
}

function apiResult(response: Record<string, unknown>, action: string): Record<string, unknown> {
  const error = record(record(response.ResponseMetadata)?.Error);
  if (error) {
    throw new ApiError(
      `${action} failed: ${String(error.Code ?? "Error")}: ${String(error.Message ?? "unknown error")}`,
    );
  }
  return record(response.Result) ?? record(response.data) ?? {};
}

function sortName(order: LogOrder): "ascend" | "descend" {
  return order === "asc" ? "ascend" : "descend";
}

function number(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function containerLog(item: Record<string, unknown>): ContainerLog {
  return {
    message: String(item.message ?? ""),
    timestampMs: nullableNumber(item.timestamp_ms),
    timestamp: String(item.timestamp_str ?? item.time ?? ""),
    podName: String(item.pod_name ?? ""),
    node: String(item.node ?? ""),
    logId: String(item.log_id ?? ""),
  };
}

function jobEvent(item: Record<string, unknown>): JobEvent {
  const first = normalizeTime(item.first_timestamp);
  const last = normalizeTime(item.last_timestamp);
  return {
    type: String(item.type ?? ""),
    reason: String(item.reason ?? ""),
    source: String(item.from ?? ""),
    message: String(item.message ?? ""),
    firstTimestamp: first.iso,
    firstTimestampMs: first.milliseconds,
    lastTimestamp: last.iso,
    lastTimestampMs: last.milliseconds,
    objectType: String(item.object_type ?? ""),
    objectId: String(item.object_id ?? ""),
  };
}

function sameCursor(
  previous: [string, string] | undefined,
  next: [string, string],
): boolean {
  return previous?.[0] === next[0] && previous[1] === next[1];
}
