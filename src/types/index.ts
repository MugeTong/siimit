export const JOB_STATUSES = [
    "queuing",
    "creating",
    "running",
    "succeeded",
    "failed",
    "stopped",
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export function isJobStatus(value: string): value is JobStatus {
    return JOB_STATUSES.includes(value as JobStatus);
}

export const PRIORITIES = ["low", "high"] as const;

export type Priority = (typeof PRIORITIES)[number];

export function checkPriority(value: number): Array<Priority> {
    if (value < 4) {
        return ["low"];
    }
    return ["low", "high"];
}

export function resolvePriority(value: number): Priority {
    if (value < 4) {
        return "low";
    }
    return "high";
}
