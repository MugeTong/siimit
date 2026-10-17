import { ApiError, AuthenticationError, ConfigurationError } from "../errors";

export class InspireClient {
  async whoami(): Promise<Record<string, unknown>> {
    const response = await this.postJson("/api/v2/user?Action=GetUserDetail", {});
    return isRecord(response.Result) ? response.Result : response;
  }

  async getJson(path: string): Promise<Record<string, unknown>> {
    return this.postJson(path, {});
  }

  async postJson(
    path: string,
    body: Record<string, unknown>,
    _referer = "/jobs/distributedTraining",
  ): Promise<Record<string, unknown>> {
    const endpoint = parseEndpoint(path);
    let process: Bun.Subprocess;
    try {
      process = Bun.spawn([
        "qz",
        endpoint.service,
        endpoint.action,
        "--output",
        "json",
        "--data",
        JSON.stringify(body),
      ], { stdout: "pipe", stderr: "pipe" });
    } catch (error) {
      throw new ConfigurationError(
        `The official qz client is required by siimit 0.19. Install it, then run \`siimit login\`. ${errorMessage(error)}`,
      );
    }

    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(process.stdout as ReadableStream<Uint8Array>).text(),
      new Response(process.stderr as ReadableStream<Uint8Array>).text(),
      process.exited,
    ]);
    if (exitCode !== 0) {
      const message = stderr.trim() || stdout.trim() || `qz exited with status ${exitCode}`;
      if (exitCode === 2 || /auth|token|login|session expired|invalid_grant/i.test(message)) {
        throw new AuthenticationError(`${message} Run \`siimit login\` and try again.`);
      }
      throw new ApiError(message);
    }

    try {
      const data: unknown = JSON.parse(stdout);
      if (isRecord(data)) return data;
    } catch (error) {
      throw new ApiError(`qz returned invalid JSON: ${errorMessage(error)}`);
    }
    throw new ApiError("qz returned an unexpected response.");
  }
}

function parseEndpoint(path: string): { service: string; action: string } {
  const match = /^\/api\/v2\/([^?]+)\?Action=([^&]+)$/.exec(path);
  if (!match) throw new ApiError(`Unsupported Inspire endpoint: ${path}`);
  return {
    service: decodeURIComponent(match[1]!),
    action: decodeURIComponent(match[2]!),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
