import { authStorage, discoveryStorage, workspaceStorage } from "@/storage";
import type { ServiceResponse } from "../types";

type JobInstances = Array<{
    name: string;
    node: string;
}>;

type JobInstancesResponse = ServiceResponse<{
    items: Array<{
        name: string;
        node: string;
    }>;
    total: number;
}>;

export async function listJobInstances(jobId: string): Promise<JobInstances> {
    const token = await authStorage.load();
    const endpoint = await discoveryStorage.load("train");

    const url = new URL(endpoint, "https://qz.sii.edu.cn");
    url.searchParams.set("Action", "ListJobInstances");
    const response = await fetch(url, {
        headers: {
            Accept: "application/json",
            Authorization: token,
            "x-inspire-client-source": "inspire-cli/5294f02",
        },
        body: JSON.stringify({
            job_id: jobId,
            page_num: 1,
            page_size: -1,
        }),
        method: "POST",
    });

    if (!response.ok) {
        throw new Error(`Failed to list job instances: ${response.status} ${response.statusText}`);
    }

    const payload = (await response.json()) as JobInstancesResponse;
    if (!("Result" in payload)) {
        const errorCode = payload.ResponseMetadata.Error.Code;
        const errorMessage = payload.ResponseMetadata.Error.Message;
        throw new Error(`API Error: ${errorCode} - ${errorMessage}`);
    }

    return payload.Result.items.map((item) => ({
        name: item.name,
        node: item.node,
    }));
}
