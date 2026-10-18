import { authStorage, discoveryStorage, workspaceStorage } from "@/storage";
import type { ServiceResponse } from "../types";

type GroupDetails = {
  cpuTotal: number;
  cpuUsed: number;
  gpuTotal: number;
  gpuUsed: number;
  gpuLowPriorityUsed: number;
};

type GetGroupResponse = ServiceResponse<{
  logic_resouces: {
    cpu_total: number;
    cpu_used: number;
    gpu_total: number;
    gpu_used: number;
    gpu_low_priority_used: number;
  };
}>;

export async function getGroup(groupId: string): Promise<GroupDetails> {
  const token = await authStorage.load();
  const endpoint = await discoveryStorage.load("workspace");
  const workspaceId = await workspaceStorage.load();
  const url = new URL(endpoint, "https://qz.sii.edu.cn");
  url.searchParams.set("Action", "GetLogicComputeGroupResource");
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: token,
      "x-inspire-client-source": "inspire-cli/5294f02",
    },
    body: JSON.stringify({
      workspace_id: workspaceId,
      logic_compute_group_id: groupId,
    }),
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch group details: ${response.statusText}`);
  }
  const payload = (await response.json()) as GetGroupResponse;
  if (!("Result" in payload)) {
    const errorCode = payload.ResponseMetadata.Error.Code;
    const errorMessage = payload.ResponseMetadata.Error.Message;
    throw new Error(`API Error: ${errorCode} - ${errorMessage}`);
  }

  return {
    cpuTotal: payload.Result.logic_resouces.cpu_total,
    cpuUsed: payload.Result.logic_resouces.cpu_used,
    gpuTotal: payload.Result.logic_resouces.gpu_total,
    gpuUsed: payload.Result.logic_resouces.gpu_used,
    gpuLowPriorityUsed: payload.Result.logic_resouces.gpu_low_priority_used,
  };
}
