import { authStorage, discoveryStorage, confStorage } from "@/storage";
import type { ServiceResponse } from "../types";
import type { JobStatus, Priority } from "@/types";
import { resolvePriority } from "@/types";
import { fetchWithTimeout } from "@/utils";

type JobMetadata = {
    jobId: string;
    jobName: string;
    status: JobStatus;
    priority: Priority;
    groupName: string;
    projectName: string;
    imageName: string;
    gpuCount: number;
    nodeCount: number;
    createdAt: number;
    finishedAt?: number;
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
    framework_config: Array<{
        image: string;
        instance_count: number;
        gpu_count: number;
    }>;
    created_at: string;
    finished_at?: string;
    running_time_ms?: string;
    command: string;
    max_run_time_ms?: string;
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
        jobName: job.name,
        status: fromApiStatus(job.status),
        priority: resolvePriority(Number(job.priority_name)),
        groupName: job.logic_compute_group_name,
        projectName: job.project_name,
        imageName: job.framework_config[0]!.image.split("/").pop()!,
        gpuCount: job.framework_config[0]!.gpu_count,
        nodeCount: job.framework_config[0]!.instance_count,
        createdAt: Number(job.created_at),
        finishedAt: job.finished_at ? Number(job.finished_at) : undefined,
        maxRunSeconds: job.max_run_time_ms
            ? Math.floor(Number(job.max_run_time_ms) / 1000)
            : undefined,
        command: job.command,
    }));
}
