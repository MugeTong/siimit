import { SiimitError } from "../errors";
import type { JobDetail } from "./job-actions";

const TERMINAL_STATUSES = new Set([
  "SUCCEEDED",
  "FAILED",
  "STOPPED",
  "CANCELLED",
  "CANCELED",
]);
const POLL_INTERVAL_MS = 60_000;

export type WaitTarget = "running" | "terminal";

export interface WaitOptions {
  target: WaitTarget;
  timeoutMs?: number;
}

export interface WaitResult {
  job: JobDetail;
  timedOut: boolean;
}

export interface WaitDependencies {
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
  onStatus?: (job: JobDetail) => void;
}

export async function waitForJob(
  fetchJob: () => Promise<JobDetail>,
  options: WaitOptions,
  dependencies: WaitDependencies = {},
): Promise<WaitResult> {
  const now = dependencies.now ?? Date.now;
  const sleep = dependencies.sleep ?? ((milliseconds) =>
    new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  const startedAt = now();
  let previousStatus = "";

  while (true) {
    const job = await fetchJob();
    if (job.status !== previousStatus) {
      dependencies.onStatus?.(job);
      previousStatus = job.status;
    }
    if (targetReached(job.status, options.target)) return { job, timedOut: false };

    const elapsed = now() - startedAt;
    if (options.timeoutMs !== undefined && elapsed >= options.timeoutMs) {
      return { job, timedOut: true };
    }
    const remaining = options.timeoutMs === undefined
      ? POLL_INTERVAL_MS
      : Math.min(POLL_INTERVAL_MS, options.timeoutMs - elapsed);
    await sleep(Math.max(0, remaining));
  }
}

export function parseWaitTarget(value: string | undefined): WaitTarget {
  if (value === undefined || value === "terminal") return "terminal";
  if (value === "running") return "running";
  throw new SiimitError("--for must be running or terminal.");
}

export function parseDuration(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const match = /^(\d+(?:\.\d+)?)(s|m|h)$/.exec(value.trim().toLowerCase());
  if (!match) throw new SiimitError("--timeout must use a duration such as 30s, 10m, or 2h.");
  const amount = Number(match[1]);
  const multiplier = match[2] === "s" ? 1_000 : match[2] === "m" ? 60_000 : 3_600_000;
  const milliseconds = amount * multiplier;
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) {
    throw new SiimitError("--timeout must be greater than zero.");
  }
  return milliseconds;
}

export function isSuccessfulTerminal(status: string): boolean {
  return status === "SUCCEEDED";
}

function targetReached(status: string, target: WaitTarget): boolean {
  if (TERMINAL_STATUSES.has(status)) return true;
  return target === "running" && status === "RUNNING";
}
