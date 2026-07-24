import { ApiError, ConfigurationError } from "../../errors";
import { asRecord } from "../../shared/records";
import type { InspireClient } from "../client";
import { listComputeGroups, listGroupPrices } from "./groups";

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
  const groups = await listComputeGroups(client, workspaceId);
  const group = groups.find((item) => item.name === requestedGroup || item.id === requestedGroup);
  if (!group) throw new ConfigurationError(`No compute group exactly matches ${JSON.stringify(requestedGroup)}.`);
  const rows = await listGroupPrices(client, {
    workspaceId,
    groupId: group.id,
    projectId,
    taskPriority,
  });
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
    groupId: group.id,
    ...(gpuType ? { gpuType } : {}),
    cpuType: String(cpuInfo?.cpu_type ?? ""),
  };
}

function memory(item: Record<string, unknown>): number {
  return number(item.memory_size_gib ?? item.memory_size ?? item.memory_size_gb);
}

function number(value: unknown): number {
  return Number(value ?? 0);
}
