import { authStorage, discoveryStorage, workspaceStorage } from "@/storage";
import type { ServiceResponse } from "../types";
import { listJobInstances } from "./list-job-instances";

type JobEvents = Array<{
    message: string;
    timestamp: number;
}>;

type JobEventsResponse = ServiceResponse<{
    events: Array<{
        last_timestamp: string;
        message: string;
        reason: string;
        type: "Normal" | "Warning";
    }>;
    total: number;
}>;

export async function listJobEvents(params: {
    jobId: string;
    order: "descend" | "ascend";
    limit?: number;
}): Promise<JobEvents> {
    const token = await authStorage.load();
    const endpoint = await discoveryStorage.load("train");

    const instances = (await listJobInstances(params.jobId)).map((instance) => instance.name);

    const url = new URL(endpoint, "https://qz.sii.edu.cn");
    url.searchParams.set("Action", "ListJobEvents");
    const response = await fetch(url, {
        headers: {
            Accept: "application/json",
            Authorization: token,
            "x-inspire-client-source": "inspire-cli/5294f02",
        },
        body: JSON.stringify({
            page_size: params.limit ?? 20,
            filter: {
                object_type: "instance",
                object_ids: instances,
            },
            sorter: [{ field: "last_timestamp", sort: params.order }],
        }),
        method: "POST",
    });

    if (!response.ok) {
        throw new Error(`Failed to list job events: ${response.status} ${response.statusText}`);
    }

    const payload = (await response.json()) as JobEventsResponse;
    if (!("Result" in payload)) {
        const errorCode = payload.ResponseMetadata.Error.Code;
        const errorMessage = payload.ResponseMetadata.Error.Message;
        throw new Error(`API Error: ${errorCode} - ${errorMessage}`);
    }

    return payload.Result.events.map((event) => ({
        message: event.message,
        timestamp: Number(event.last_timestamp),
    }));
}
