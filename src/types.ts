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

const LOW_PRIORITY_LEVEL = 1;
const HIGH_PRIORITY_LEVEL = 4;
export const PRIORITIES = ["low", "high"] as const;
export type Priority = (typeof PRIORITIES)[number];

export function checkPriority(value: number): Array<Priority> {
    if (value < HIGH_PRIORITY_LEVEL) {
        return ["low"];
    }
    return ["low", "high"];
}

export function resolvePriority(value: number): Priority {
    if (value < HIGH_PRIORITY_LEVEL) {
        return "low";
    }
    return "high";
}

export function toPriorityNumber(priority: Priority): number {
    if (priority === "low") {
        return LOW_PRIORITY_LEVEL;
    }
    return HIGH_PRIORITY_LEVEL;
}
