import { authStorage, discoveryStorage, workspaceStorage } from "@/storage";
import type { ServiceResponse } from "../types";
import { resolvePriority } from "@/types";

type JobResult = {
    jobId: string;
    name: string;
    status: string;
    priority: string;
    groupId: string;
    projectId: string;
    command: string;
};

type SubmitJobResponse = ServiceResponse<{
    job_id: string;
    name: string;
    status: string;
    task_priority: number;
    logic_compute_group_id: string;
    project_id: string;
    command: string;
}>;

type SubmitJobParams = {
    name: string;
    projectId: string;
    groupId: string;
    imageName: string;
    command?: string;
    commandFile?: string;
    quotaId: string;
    priority: number;
    maxRunSeconds: number;
    nodeCount: number;
};

export async function submitJob(params: SubmitJobParams): Promise<JobResult> {
    const token = await authStorage.load();
    const endpoint = await discoveryStorage.load("train");
    const workspaceId = await workspaceStorage.load();
    const url = new URL(endpoint, "https://qz.sii.edu.cn");
    url.searchParams.set("Action", "CreateJob");
    const response = await fetch(url, {
        headers: {
            Accept: "application/json",
            Authorization: token,
            "x-inspire-client-source": "inspire-cli/5294f02",
        },
        body: JSON.stringify({
            workspace_id: workspaceId,
            project_id: params.projectId,
            logic_compute_group_id: params.groupId,
            name: params.name,
            framework: "pytorch",
            framework_config: [
                {
                    spec_id: params.quotaId,
                    image: `docker.sii.shaipower.online/inspire-studio/${params.imageName}`,
                    image_type: "SOURCE_PRIVATE",
                    instance_count: params.nodeCount,
                },
            ],
            max_running_time_ms: String(params.maxRunSeconds * 1000),
            command: params.command || `bash ${params.commandFile}`,
            task_priority: params.priority,
        }),
        method: "POST",
    });

    if (!response.ok) {
        throw new Error(`Failed to submit job: ${response.statusText}`);
    }
    const payload = (await response.json()) as SubmitJobResponse;
    if (!("Result" in payload)) {
        const errorCode = payload.ResponseMetadata.Error.Code;
        const errorMessage = payload.ResponseMetadata.Error.Message;
        throw new Error(`API Error: ${errorCode} - ${errorMessage}`);
    }

    return {
        jobId: payload.Result.job_id,
        name: payload.Result.name,
        status: "queuing",
        priority: resolvePriority(payload.Result.task_priority),
        groupId: payload.Result.logic_compute_group_id,
        projectId: payload.Result.project_id,
        command: payload.Result.command,
    };
}
