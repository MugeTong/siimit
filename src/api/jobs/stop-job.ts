import { authStorage, discoveryStorage } from "@/storage";
import type { ServiceResponse } from "../types";

type StopJobResponse = ServiceResponse<undefined>;

export async function stopJob(jobId: string): Promise<void> {
    const token = await authStorage.load();
    const endpoint = await discoveryStorage.load("train");
    // const workspaceId = await discoveryStorage.load();
    const url = new URL(endpoint, "https://qz.sii.edu.cn");
    url.searchParams.set("Action", "StopJob");
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
        throw new Error(`Failed to stop job: ${response.statusText}`);
    }
    const payload = (await response.json()) as StopJobResponse;
    if (!("Service" in payload.ResponseMetadata)) {
        const errorCode = payload.ResponseMetadata.Error.Code;
        const errorMessage = payload.ResponseMetadata.Error.Message;
        throw new Error(`API Error: ${errorCode} - ${errorMessage}`);
    }
}
