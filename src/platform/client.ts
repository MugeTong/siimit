import type { BrowserSession } from "../config";
import { ApiError, AuthenticationError } from "../errors";
import { CookieHttpClient } from "./http";

export class InspireClient {
  private readonly http: CookieHttpClient;
  private readonly baseUrl: string;

  constructor(private readonly session: BrowserSession, http?: CookieHttpClient) {
    this.baseUrl = session.base_url.replace(/\/$/, "");
    this.http = http ?? CookieHttpClient.fromStorage(session.storage_state.cookies);
  }

  async whoami(): Promise<Record<string, unknown>> {
    const response = await this.http.get(`${this.baseUrl}/api/v1/user/detail`, {
      headers: { accept: "application/json", referer: `${this.baseUrl}/login` },
    });
    const data = await this.responseJson(response);
    return isRecord(data.data) ? data.data : data;
  }

  async submit(payload: Record<string, unknown>): Promise<{ jobId?: string; result: Record<string, unknown> }> {
    const response = await this.http.post(`${this.baseUrl}/api/v2/train?Action=CreateJobConsole`, {
      headers: { accept: "application/json", "content-type": "application/json", referer: `${this.baseUrl}/jobs/distributedTraining` },
      body: JSON.stringify(payload),
    });
    const data = await this.responseJson(response);
    const metadata = data.ResponseMetadata;
    if (isRecord(metadata) && isRecord(metadata.Error)) {
      const code = String(metadata.Error.Code ?? "Error");
      const message = String(metadata.Error.Message ?? "unknown error");
      const priority = Number(payload.task_priority);
      const advice = /优先级|priority/i.test(message) && Number.isFinite(priority)
        ? ` Requested priority: ${priority}. Run \`siimit projects\` to see whether low or high is available.`
        : "";
      throw new ApiError(`Inspire rejected the task: ${code}: ${message}.${advice}`);
    }
    const candidate = isRecord(data.Result) ? data.Result : isRecord(data.data) ? data.data : {};
    const framework = Array.isArray(candidate.framework_config) && isRecord(candidate.framework_config[0])
      ? candidate.framework_config[0]
      : undefined;
    const actualGpuCount = Number(framework?.gpu_count);
    if (Number.isFinite(actualGpuCount) && actualGpuCount >= 0) candidate.gpu_count = actualGpuCount;
    if (framework?.shm_gi === 0) framework.shm_gi = "platform_default";
    const id = candidate.job_id ?? candidate.id ?? candidate.task_id;
    return id == null ? { result: candidate } : { jobId: String(id), result: candidate };
  }

  async getJson(path: string, referer = "/jobs/distributedTraining"): Promise<Record<string, unknown>> {
    const response = await this.http.get(`${this.baseUrl}${path}`, {
      headers: { accept: "application/json", referer: `${this.baseUrl}${referer}` },
    });
    return this.responseJson(response);
  }

  async postJson(
    path: string,
    body: Record<string, unknown>,
    referer = "/jobs/distributedTraining",
  ): Promise<Record<string, unknown>> {
    const response = await this.http.post(`${this.baseUrl}${path}`, {
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        referer: `${this.baseUrl}${referer}`,
      },
      body: JSON.stringify(body),
    });
    return this.responseJson(response);
  }

  private async responseJson(response: Response): Promise<Record<string, unknown>> {
    if (response.status === 401 || response.status === 403) throw new AuthenticationError("Session expired or access denied. Run `siimit login` again.");
    if (!response.ok) throw new ApiError(`Inspire returned HTTP ${response.status}.`);
    try {
      const data: unknown = await response.json();
      if (isRecord(data)) return data;
    } catch {}
    throw new ApiError("Inspire returned invalid JSON.");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
