import { ApiError, ConfigurationError } from "../../errors";
import { asRecord, records } from "../../shared/records";
import type { InspireClient } from "../client";

export interface ResolvedQuota {
  gpu: number;
  cpu: number;
  memoryGiB: number;
  quotaId: string;
  groupId: string;
  gpuType?: string;
  cpuType: string;
}

export async function resolveQuota(
  client: InspireClient,
  workspaceId: string,
  requestedGroup: string,
  gpuCount: number,
  projectId: string,
  taskPriority: number,
): Promise<ResolvedQuota> {
  const groupResponse = await client.postJson("/api/v1/logic_compute_groups/list", {
    page_size: -1,
    page_num: 1,
    filter: { workspace_id: workspaceId },
  });
  const groups = records(asRecord(groupResponse.data)?.logic_compute_groups);
  const group = groups.find((item) => groupName(item) === requestedGroup || groupId(item) === requestedGroup);
  if (!group) throw new ConfigurationError(`No compute group exactly matches ${JSON.stringify(requestedGroup)}.`);
  const selectedGroupId = groupId(group);
  const response = await client.postJson("/api/v1/resource_prices/logic_compute_groups", {
    workspace_id: workspaceId,
    schedule_config_type: "SCHEDULE_CONFIG_TYPE_TRAIN",
    logic_compute_group_id: selectedGroupId,
    project_id: projectId,
    task_priority: taskPriority,
  });
  const data = response.data;
  const rows = Array.isArray(data)
    ? records(data)
    : records(asRecord(data)?.lcg_resource_spec_prices ?? asRecord(data)?.resource_spec_prices ?? asRecord(data)?.list);
  const price = rows
    .filter((item) => number(item.gpu_count) === gpuCount)
    .sort((left, right) => number(right.cpu_count) - number(left.cpu_count) || memory(right) - memory(left))[0];
  if (!price) throw new ConfigurationError(`No ${gpuCount}-GPU quota exists in compute group ${requestedGroup}.`);
  const quotaId = String(price.quota_id ?? price.spec_id ?? "");
  if (!quotaId) throw new ApiError("Matched quota has no quota_id.");
  const gpuInfo = asRecord(price.gpu_info);
  const cpuInfo = asRecord(price.cpu_info);
  const gpuType = String(gpuInfo?.gpu_type ?? price.gpu_type ?? "");
  return {
    gpu: gpuCount,
    cpu: number(price.cpu_count),
    memoryGiB: memory(price),
    quotaId,
    groupId: selectedGroupId,
    ...(gpuType ? { gpuType } : {}),
    cpuType: String(cpuInfo?.cpu_type ?? ""),
  };
}

function groupId(item: Record<string, unknown>): string {
  return String(item.logic_compute_group_id ?? item.id ?? "");
}

function groupName(item: Record<string, unknown>): string {
  return String(item.name ?? item.logic_compute_group_name ?? "");
}

function memory(item: Record<string, unknown>): number {
  return number(item.memory_size_gib ?? item.memory_size ?? item.memory_size_gb);
}

function number(value: unknown): number {
  return Number(value ?? 0);
}
