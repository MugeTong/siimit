import { Command, parseDuration, prettyPrint, Ref, sleep, timestamp2date } from "@/utils";
import { jobsApi } from "@/api";
import type { JobStatus } from "@/types";

const jobId = new Ref<string>("");

const forOption = new Ref<"running" | "terminated">("terminated");
const timeoutOption = new Ref<string>("");

const jsonFlag = new Ref<boolean>(false);

const validStatuses = ["running", "terminated"] as const;
type WaitForStatus = (typeof validStatuses)[number];

async function waitHandler(self: Command) {
    if (!validStatuses.includes(forOption.value)) {
        throw new Error(
            `Invalid status: '${forOption.value}'. Valid statuses are: ${validStatuses.join(", ")}`,
        );
    }

    const timeoutDuration = parseDuration(timeoutOption.value);
    if (!Number.isFinite(timeoutDuration) || timeoutDuration <= 0) {
        throw new Error("Timeout duration must be a positive finite value");
    }

    const statusMap: Record<WaitForStatus, readonly JobStatus[]> = {
        running: ["running", "succeeded", "failed", "stopped"],
        terminated: ["succeeded", "failed", "stopped"],
    };
    const targetStatuses = statusMap[forOption.value];
    const deadline = Date.now() + timeoutDuration;

    let numChecks = 0;
    let checkInterval = 1000;
    let data;

    while (true) {
        data = await jobsApi.getJob(jobId.value);
        if (targetStatuses.includes(data.status)) {
            break;
        }

        const remaining = deadline - Date.now();
        if (remaining <= 0) {
            throw new Error(`Timeout reached.\nCurrent status is '${data.status}'.`);
        }

        await sleep(Math.min(checkInterval, 12000, remaining));

        checkInterval = Math.min(checkInterval * 2, 12000);
    }

    // Handle the results for better display
    const result = {
        ...data,
        status: data.status.toUpperCase(),
        createdAt: timestamp2date(data.createdAt),
        finishedAt: data.finishedAt ? timestamp2date(data.finishedAt) : "N/A",
    };

    // Output the results
    prettyPrint(result, jsonFlag.value, [
        "jobId",
        "name",
        "status",
        "priority",
        "groupName",
        "createdAt",
        "finishedAt",
    ]);
}

const waitCommand = new Command({
    name: "wait",
    short: "wait for a job to reach a status",
    long: "Wait for a job to reach a specific status.",
    run: waitHandler,
});

waitCommand.setPos(jobId, {
    name: "job-id",
});

waitCommand.setOption(forOption, {
    name: "for",
    required: false,
    valueName: "status",
    defaultValue: "terminated",
    description: `wait for job status: ${validStatuses.join(", ")}`,
});
waitCommand.setOption(timeoutOption, {
    name: "timeout",
    required: true,
    valueName: "duration",
    description: "timeout duration (e.g. 60s, 10m, 2h, 1d)",
});

waitCommand.setFlag(jsonFlag, {
    name: "json",
    shortName: "j",
    description: "output in JSON format",
});

export { waitCommand };
