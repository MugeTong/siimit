import { authStorage } from "@/storage";
import { discoveryStorage } from "@/storage";
import { discoveryApi } from "../discovery";
import type { ServiceResponse } from "../types";
import type { JobStatus } from "@/types";

type JobMetadata = {
  job_id: string;
  name: string;
  status: JobStatus;
  logic_compute_group_id: string;
  logic_compute_group_name: string;
  project_id: string;
  project_name: string;
  created_at: number;
  gpu_count: number;
  command: string;
};

type JobApiStatus = `job_${JobStatus}`;

type JobApiMetadata = {
  job_id: string;
  name: string;
  status: JobApiStatus;
  logic_compute_group_id: string;
  logic_compute_group_name: string;
  project_id: string;
  project_name: string;
  created_at: string;
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

export async function listJobs(
  params: ListJobParams,
): Promise<Array<JobMetadata>> {
  const token = await authStorage.load();
  const endpoint = await discoveryStorage.load("train");
  const url = new URL(endpoint, "https://qz.sii.edu.cn");
  url.searchParams.set("Action", "ListJobs");
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: token,
      "x-inspire-client-source": "inspire-cli/5294f02",
    },
    body: JSON.stringify({
      PageSize: params.limit ?? 10,
      PageNumber: 1,
      Keyword: params.keyword,
      Status: params.status ? toApiStatus(params.status) : undefined,
      WorkspaceId: "ws-9dcc0e1f-80a4-4af2-bc2f-0e352e7b17e6",
    }),
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch job queues: ${response.status} - ${response.statusText}`,
    );
  }
  const payload = (await response.json()) as ListJobsResponse;
  if (!("Result" in payload)) {
    throw new Error(
      `API Error: ${payload.ResponseMetadata.Error.Code} - ${payload.ResponseMetadata.Error.Message}`,
    );
  }
  return payload.Result.jobs.map((job) => ({
    job_id: job.job_id,
    name: job.name,
    status: fromApiStatus(job.status),
    logic_compute_group_id: job.logic_compute_group_id,
    logic_compute_group_name: job.logic_compute_group_name,
    project_id: job.project_id,
    project_name: job.project_name,
    created_at: Number(job.created_at),
    gpu_count: job.gpu_count,
    command: job.command,
  }));
}
