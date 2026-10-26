export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

export class RequestTimeoutError extends Error {
    constructor(timeoutMs: number) {
        super(`Request timed out after ${timeoutMs / 1000}s`);
        this.name = "RequestTimeoutError";
    }
}

export async function fetchWithTimeout(
    input: string | URL | Request,
    init: RequestInit = {},
    timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        return await fetch(input, {
            ...init,
            signal: controller.signal,
        });
    } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
            throw new RequestTimeoutError(timeoutMs);
        }
        throw error;
    } finally {
        clearTimeout(timer);
    }
}
