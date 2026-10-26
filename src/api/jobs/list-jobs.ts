import { authStorage, discoveryStorage, confStorage } from "@/storage";
import type { ServiceResponse } from "../types";
import type { JobStatus, Priority } from "@/types";
import { resolvePriority } from "@/types";
import { fetchWithTimeout } from "@/utils";

type JobMetadata = {
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
    gpuCount: number;
    command: string;
};

type JobApiStatus = `job_${JobStatus}`;

type JobApiMetadata = {
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
    gpu_count: number;
    command: string;
};

type ListJobsResponse = ServiceResponse<{
    jobs: Array<JobApiMetadata>;
    total: number;
}>;

type ListJobParams = {
    keyword?: string;
    status?: JobStatus;
    limit?: number;
};

function toApiStatus(status: JobStatus): JobApiStatus {
    return `job_${status}` as JobApiStatus;
}

function fromApiStatus(status: JobApiStatus): JobStatus {
    return status.slice(4) as JobStatus;
}

export async function listJobs(params: ListJobParams): Promise<Array<JobMetadata>> {
    const token = await authStorage.load();
    const endpoint = await discoveryStorage.load("train");
    const { baseUrl, workspaceId } = await confStorage.load();
    const url = new URL(endpoint, baseUrl);
    url.searchParams.set("Action", "ListJobs");
    const response = await fetchWithTimeout(url, {
        headers: {
            Accept: "application/json",
            Authorization: token,
            "x-inspire-client-source": "inspire-cli/5294f02",
        },
        body: JSON.stringify({
            page_size: params.limit ?? 10,
            page_number: 1,
            keyword: params.keyword,
            status: params.status ? toApiStatus(params.status) : undefined,
            workspace_id: workspaceId,
        }),
        method: "POST",
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch job queues: ${response.status} - ${response.statusText}`);
    }
    const payload = (await response.json()) as ListJobsResponse;
    if (!("Result" in payload)) {
        const errorCode = payload.ResponseMetadata.Error.Code;
        const errorMessage = payload.ResponseMetadata.Error.Message;
        throw new Error(`API Error: ${errorCode} - ${errorMessage}`);
    }

    return payload.Result.jobs.map((job) => ({
        jobId: job.job_id,
        name: job.name,
        status: fromApiStatus(job.status),
        priority: resolvePriority(Number(job.priority_name)),
        groupId: job.logic_compute_group_id,
        groupName: job.logic_compute_group_name,
        projectId: job.project_id,
        projectName: job.project_name,
        createdAt: Number(job.created_at),
        gpuCount: job.gpu_count,
        command: job.command,
    }));
}
