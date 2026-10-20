import { authStorage, discoveryStorage, workspaceStorage } from "@/storage";
import type { ServiceResponse } from "../types";
import { getGroup } from "./get-group";

type GroupMetadata = {
    groupId: string;
    name: string;
    gpuTotal: number;
    lowPriUsed: number;
    free: number;
};

type GroupApiMetadata = {
    logic_compute_group_id: string;
    name: string;
    node_count: number;
};

type ListGroupsResponse = ServiceResponse<{
    logic_compute_groups: Array<GroupApiMetadata>;
    total: number;
}>;

export async function listGroups(): Promise<Array<GroupMetadata>> {
    const token = await authStorage.load();
    const endpoint = await discoveryStorage.load("workspace");
    const workspaceId = await workspaceStorage.load();
    const url = new URL(endpoint, "https://qz.sii.edu.cn");
    url.searchParams.set("Action", "ListLogicComputeGroups");
    const response = await fetch(url, {
        headers: {
            Accept: "application/json",
            Authorization: token,
            "x-inspire-client-source": "inspire-cli/5294f02",
        },
        body: JSON.stringify({
            filter: {
                workspace_id: workspaceId,
            },
            pageSize: 5000,
        }),
        method: "POST",
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch groups: ${response.statusText}`);
    }
    const payload = (await response.json()) as ListGroupsResponse;
    if (!("Result" in payload)) {
        const errorCode = payload.ResponseMetadata.Error.Code;
        const errorMessage = payload.ResponseMetadata.Error.Message;
        throw new Error(`API Error: ${errorCode} - ${errorMessage}`);
    }

    const outputs = await Promise.all(
        payload.Result.logic_compute_groups.map(async (group) => {
            const details = await getGroup(group.logic_compute_group_id);
            return {
                ...group,
                ...details,
            };
        }),
    );

    return outputs.map((group) => ({
        groupId: group.logic_compute_group_id,
        name: group.name,
        gpuTotal: group.gpuTotal,
        lowPriUsed: group.gpuLowPriorityUsed,
        free: Math.max(0, group.gpuTotal - group.gpuUsed),
    }));
}
