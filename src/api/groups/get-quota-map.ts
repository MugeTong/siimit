import { authStorage, discoveryStorage, workspaceStorage } from "@/storage";
import type { ServiceResponse } from "../types";
import type { Priority } from "@/types";

type GetQuotaMapResponse = ServiceResponse<{
  lcg_resource_spec_prices: Array<{
    gpu_count: number;
    quota_id: string;
  }>;
}>;

export async function getQuotaMap(
  groupId: string,
  priority: Priority,
): Promise<Record<number, string>> {
  const token = await authStorage.load();
  const endpoint = await discoveryStorage.load("resource-price");
  const workspaceId = await workspaceStorage.load();
  const url = new URL(endpoint, "https://qz.sii.edu.cn");
  url.searchParams.set("Action", "GetLogicComputeGroupResourceSpecPrices");
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: token,
      "x-inspire-client-source": "inspire-cli/5294f02",
    },
    body: JSON.stringify({
      logic_compute_group_id: groupId,
      workspace_id: workspaceId,
      schedule_config_type: "SCHEDULE_CONFIG_TYPE_TRAIN",
      task_priority: priority === "high" ? 4 : 1,
    }),
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch quota map: ${response.statusText}`);
  }
  const payload = (await response.json()) as GetQuotaMapResponse;
  if (!("Result" in payload)) {
    const errorCode = payload.ResponseMetadata.Error.Code;
    const errorMessage = payload.ResponseMetadata.Error.Message;
    throw new Error(`API Error: ${errorCode} - ${errorMessage}`);
  }

  const quotaMap: Record<number, string> = {};
  for (const spec of payload.Result.lcg_resource_spec_prices) {
    quotaMap[spec.gpu_count] = spec.quota_id;
  }
  // console.log(`Quota map for group ${groupId}:`, quotaMap);
  return quotaMap;
}
