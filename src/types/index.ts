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
