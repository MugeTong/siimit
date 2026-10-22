import { authStorage, discoveryStorage, workspaceStorage } from "@/storage";
import type { ServiceResponse } from "../types";
import { listJobInstances } from "./list-job-instances";

type JobLogs = Array<{
    message: string;
    timestamp: number;
}>;

type JobLogsResponse = ServiceResponse<{
    logs: Array<{
        log_id: string;
        message: string;
        node: string;
        pod_name: string;
        time: string;
        timestamp_ms: string;
        timestamp_str: string;
    }>;
    total: number;
}>;

export async function getJobLogs(params: {
    jobId: string;
    order: "descend" | "ascend";
    limit?: number;
}): Promise<JobLogs> {
    const token = await authStorage.load();
    const endpoint = await discoveryStorage.load("train");

    const instances = (await listJobInstances(params.jobId)).map((instance) => instance.name);

    const url = new URL(endpoint, "https://qz.sii.edu.cn");
    url.searchParams.set("Action", "GetJobLog");
    const response = await fetch(url, {
        headers: {
            Accept: "application/json",
            Authorization: token,
            "x-inspire-client-source": "inspire-cli/5294f02",
        },
        body: JSON.stringify({
            page_size: params.limit ?? 20,
            filter: {
                podNames: instances,
            },
            sorter: [
                { field: "time", sort: params.order },
                { field: "log-id.keyword", sort: params.order },
            ],
        }),
        method: "POST",
    });

    if (!response.ok) {
        throw new Error(`Failed to get job logs: ${response.status} ${response.statusText}`);
    }

    const payload = (await response.json()) as JobLogsResponse;
    if (!("Result" in payload)) {
        const errorCode = payload.ResponseMetadata.Error.Code;
        const errorMessage = payload.ResponseMetadata.Error.Message;
        throw new Error(`API Error: ${errorCode} - ${errorMessage}`);
    }

    return payload.Result.logs.map((log) => ({
        message: log.message,
        timestamp: Number(log.timestamp_ms),
    }));
}
