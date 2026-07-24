import { ApiError } from "../errors";
import { asRecord as record, records } from "../shared/records";
import type { InspireClient } from "./client";

export class InstanceNotReadyError extends ApiError {
  constructor() {
    super("The container instance is not registered by the platform yet.");
  }
}

export async function createTrainJob(
  client: InspireClient,
  payload: Record<string, unknown>,
): Promise<{ jobId?: string; result: Record<string, unknown> }> {
  const response = await client.postJson(
    "/api/v2/train?Action=CreateJobConsole",
    payload,
  );
  const candidate = v2Result(response, "CreateJobConsole", (code, message) => {
    const priority = Number(payload.task_priority);
    const advice = /优先级|priority/i.test(message) && Number.isFinite(priority)
      ? ` Requested priority: ${priority}. Run \`siimit projects\` to see whether low or high is available.`
      : "";
    return `Inspire rejected the task: ${code}: ${message}.${advice}`;
  });
  const framework = records(candidate.framework_config)[0];
  const actualGpuCount = Number(framework?.gpu_count);
  if (Number.isFinite(actualGpuCount) && actualGpuCount >= 0) {
    candidate.gpu_count = actualGpuCount;
  }
  if (framework?.shm_gi === 0) framework.shm_gi = "platform_default";
  const id = candidate.job_id ?? candidate.id ?? candidate.task_id;
  return id == null
    ? { result: candidate }
    : { jobId: String(id), result: candidate };
}

export async function getTrainJob(
  client: InspireClient,
  jobId: string,
): Promise<Record<string, unknown>> {
  return v2Result(
    await client.postJson("/api/v2/train?Action=GetJob", { job_id: jobId }),
    "GetJob",
  );
}

export async function listTrainJobs(
  client: InspireClient,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return v2Result(
    await client.postJson("/api/v2/train?Action=ListJobs", body),
    "ListJobs",
  );
}

export async function stopTrainJob(
  client: InspireClient,
  jobId: string,
): Promise<Record<string, unknown>> {
  return v2Result(
    await client.postJson("/api/v2/train?Action=StopJob", { job_id: jobId }),
    "StopJob",
  );
}

export async function removeTrainJob(
  client: InspireClient,
  jobId: string,
): Promise<Record<string, unknown>> {
  const response = await client.postJson(
    "/api/v1/train_job/delete",
    { job_id: jobId },
  );
  if (response.code !== undefined && Number(response.code) !== 0) {
    const message = String(response.message ?? response.code);
    if (/already deleted|already absent|not found/i.test(message)) {
      return { already_absent: true };
    }
    throw new ApiError(`Delete job failed: ${message}.`);
  }
  return record(response.data) ?? {};
}

export async function listTrainJobInstances(
  client: InspireClient,
  jobId: string,
  pageSize: number,
): Promise<Record<string, unknown>[]> {
  const response = await client.postJson("/api/v2/train?Action=ListJobInstances", {
    page_num: 1,
    page_size: pageSize,
    job_id: jobId,
  });
  if (v2Error(response)) return [];
  return records(v2Result(response, "ListJobInstances").items);
}

export async function getTrainJobLogPage(
  client: InspireClient,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const response = await client.postJson("/api/v2/train?Action=GetJobLog", body);
  const error = v2Error(response);
  if (
    error &&
    /Invalid instance names.*instances.*got 0/i.test(error.message)
  ) {
    throw new InstanceNotReadyError();
  }
  return v2Result(response, "GetJobLog");
}

export async function listTrainJobEvents(
  client: InspireClient,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return v2Result(
    await client.postJson("/api/v2/train?Action=ListJobEvents", body),
    "ListJobEvents",
  );
}

function v2Result(
  response: Record<string, unknown>,
  action: string,
  formatError = (code: string, message: string) =>
    `${action} failed: ${code}: ${message}`,
): Record<string, unknown> {
  const error = v2Error(response);
  if (error) throw new ApiError(formatError(error.code, error.message));
  return record(response.Result) ?? record(response.data) ?? {};
}

function v2Error(
  response: Record<string, unknown>,
): { code: string; message: string } | undefined {
  const error = record(record(response.ResponseMetadata)?.Error);
  if (!error) return undefined;
  return {
    code: String(error.Code ?? "Error"),
    message: String(error.Message ?? "unknown error"),
  };
}
