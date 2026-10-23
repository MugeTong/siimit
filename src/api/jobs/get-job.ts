import { authStorage, discoveryStorage } from "@/storage";
import type { ServiceResponse } from "../types";
import { resolvePriority, type JobStatus, type Priority } from "@/types";

type JobDetails = {
    jobId: string;
    name: string;
    status: JobStatus;
    priority: Priority;
    groupId: string;
    groupName: string;
    projectId: string;
    projectName: string;
    createdAt: number;
    finishedAt?: number;
    runningSeconds?: number;
    gpuCount: number;
    command: string;
};

type JobApiStatus = `job_${JobStatus}`;

type GetJobResponse = ServiceResponse<{
    job_id: string;
    name: string;
    status: JobApiStatus;
    priority_name: string;
    logic_compute_group_id: string;
    logic_compute_group_name: string;
    project_id: string;
    project_name: string;
    created_at: string;
    finished_at?: string;
    running_time_ms?: string;
    gpu_count: number;
    command: string;
}>;

export async function getJob(jobId: string): Promise<JobDetails> {
    const token = await authStorage.load();
    const endpoint = await discoveryStorage.load("train");
    // const workspaceId = await workspaceStorage.load();
    const url = new URL(endpoint, "https://qz.sii.edu.cn");
    url.searchParams.set("Action", "GetJob");
    const response = await fetch(url, {
        headers: {
            Accept: "application/json",
            Authorization: token,
            "x-inspire-client-source": "inspire-cli/5294f02",
        },
        body: JSON.stringify({
            job_id: jobId,
        }),
        method: "POST",
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch job details: ${response.statusText}`);
    }

    const payload = (await response.json()) as GetJobResponse;
    if (!("Result" in payload)) {
        const errorCode = payload.ResponseMetadata.Error.Code;
        let errorMessage = payload.ResponseMetadata.Error.Message;
        errorMessage = errorMessage === "Access denied" ? "Job not found" : errorMessage;
        throw new Error(`API Error: ${errorCode} - ${errorMessage}`);
    }

    return {
        jobId: payload.Result.job_id,
        name: payload.Result.name,
        status: payload.Result.status.slice(4) as JobStatus,
        priority: resolvePriority(Number(payload.Result.priority_name)),
        groupId: payload.Result.logic_compute_group_id,
        groupName: payload.Result.logic_compute_group_name,
        projectId: payload.Result.project_id,
        projectName: payload.Result.project_name,
        createdAt: Number(payload.Result.created_at),
        finishedAt: payload.Result.finished_at ? Number(payload.Result.finished_at) : undefined,
        runningSeconds: payload.Result.running_time_ms
            ? Math.floor(Number(payload.Result.running_time_ms) / 1000)
            : undefined,
        gpuCount: payload.Result.gpu_count,
        command: payload.Result.command,
    };
}
