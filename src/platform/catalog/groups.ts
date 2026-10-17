import { asRecord, records } from "../../shared/records";
import type { InspireClient } from "../client";

export interface ComputeGroup {
  id: string;
  name: string;
}

export interface GroupCapacity {
  total: number;
  used: number;
  lowPriorityUsed: number;
  gpuType: string;
}

export interface GroupPriceRequest {
  workspaceId: string;
  groupId: string;
  projectId: string;
  taskPriority: number;
}

export async function listComputeGroups(
  client: InspireClient,
  workspaceId: string,
): Promise<ComputeGroup[]> {
  const response = await client.postJson("/api/v2/workspace?Action=ListLogicComputeGroups", {
    page_size: -1,
    page_num: 1,
    filter: { workspace_id: workspaceId },
  });
  return records(asRecord(response.Result)?.logic_compute_groups).flatMap((item) => {
    const id = String(item.logic_compute_group_id ?? item.id ?? "");
    if (!id) return [];
    return [{
      id,
      name: String(item.name ?? item.logic_compute_group_name ?? id),
    }];
  });
}

export async function getGroupCapacity(
  client: InspireClient,
  workspaceId: string,
  groupId: string,
): Promise<GroupCapacity> {
  const response = await client.postJson("/api/v2/workspace?Action=GetLogicComputeGroupResource", {
    workspace_id: workspaceId,
    logic_compute_group_id: groupId,
  });
  const data = asRecord(response.Result) ?? {};
  const resources = asRecord(data.logic_resouces) ?? {};
  const gpuInfo = asRecord(records(data.gpu_type_stats)[0]?.gpu_info);
  return {
    total: integer(resources.gpu_total),
    used: integer(resources.gpu_used),
    lowPriorityUsed: integer(resources.gpu_low_priority_used),
    gpuType: String(gpuInfo?.gpu_type_display ?? gpuInfo?.gpu_product_simple ?? "GPU"),
  };
}

export async function listGroupPrices(
  client: InspireClient,
  request: GroupPriceRequest,
): Promise<Record<string, unknown>[]> {
  const response = await client.postJson("/api/v2/resource-price?Action=GetLogicComputeGroupResourceSpecPrices", {
    workspace_id: request.workspaceId,
    schedule_config_type: "SCHEDULE_CONFIG_TYPE_TRAIN",
    logic_compute_group_id: request.groupId,
    project_id: request.projectId,
    task_priority: request.taskPriority,
  });
  const data = response.Result;
  return Array.isArray(data)
    ? records(data)
    : records(
      asRecord(data)?.lcg_resource_spec_prices ??
      asRecord(data)?.resource_spec_prices ??
      asRecord(data)?.list
    );
}

function integer(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}
