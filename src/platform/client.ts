import type { BrowserSession } from "../config";
import { ApiError, AuthenticationError } from "../errors";
import { CookieHttpClient } from "./http";

export class InspireClient {
  private readonly http: CookieHttpClient;
  private readonly baseUrl: string;

  constructor(session: BrowserSession, http?: CookieHttpClient) {
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
