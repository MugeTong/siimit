import { authStorage, discoveryStorage, confStorage } from "@/storage";
import type { ServiceResponse } from "../types";
import { fetchWithTimeout } from "@/utils";

type DeleteJobResponse = ServiceResponse<undefined>;

export async function deleteJob(jobId: string): Promise<void> {
    const token = await authStorage.load();
    const endpoint = await discoveryStorage.load("train");
    const { baseUrl, workspaceId } = await confStorage.load();
    const url = new URL(endpoint, baseUrl);
    url.searchParams.set("Action", "DeleteJob");
    const response = await fetchWithTimeout(url, {
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
        throw new Error(`Failed to delete job: ${response.statusText}`);
    }
    const payload = (await response.json()) as DeleteJobResponse;
    if (!("Service" in payload.ResponseMetadata)) {
        const errorCode = payload.ResponseMetadata.Error.Code;
        const errorMessage = payload.ResponseMetadata.Error.Message;
        throw new Error(`API Error: ${errorCode} - ${errorMessage}`);
    }
}
