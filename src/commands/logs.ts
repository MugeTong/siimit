import { SiimitError } from "../errors";
import {
  getContainerLogs,
  getJobEvents,
  type JobEvent,
  type LogOrder,
  type ContainerLog,
} from "../domain/job-logs";
import { validateJobId } from "../domain/job-actions";
import type { Command } from "./command";
import { option } from "./args";
import { withClient } from "./runtime";

export const logsCommand: Command = {
  name: "logs",
  short: "show container output or job events",
  description: "Read container stdout/stderr or platform scheduling events for a training job.",
  usage: "siimit logs <job-id> [--events] [--order asc|desc] [--limit NUMBER | --all] [--json]",
  valueOptions: ["--order", "--limit"],
  flagOptions: ["--events", "--all", "--json"],
  maxPositionals: 1,
  details: [
    "Options:",
    "  --events        Show platform and Kubernetes events instead of container output",
    "  --order ORDER   asc for oldest-first, desc for newest-first (default: asc)",
    "  --limit NUMBER  Stop after NUMBER entries (default: 200)",
    "  --all           Load all container logs",
    "  --json          Print structured JSON",
    "  -h, --help      Show this help",
    "",
    "Pod names and the time range are derived automatically from the job.",
    "Use --all to load large container logs automatically across platform pages.",
    "Platform events default to 200 entries. This version does not support --follow.",
  ].join("\n"),
  async run(args) {
    const jobId = validateJobId(positional(args));
    const requestedLimit = option(args, "--limit");
    const all = args.includes("--all");
    if (all && requestedLimit !== undefined) {
      throw new SiimitError("--all and --limit cannot be used together.");
    }
    if (all && args.includes("--events")) {
      throw new SiimitError("--all currently applies to container logs, not --events.");
    }
    const limit = all ? undefined : parseLimit(requestedLimit);
    const order = parseOrder(option(args, "--order"));
    const result = args.includes("--events")
      ? await withClient((client) => getJobEvents(client, jobId, limit ?? 200, order))
      : await withClient((client) => getContainerLogs(client, jobId, limit, order));
    if (args.includes("--json")) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    if (result.kind === "events") {
      for (const event of result.items as JobEvent[]) console.log(formatEvent(event));
    } else {
      for (const log of result.items as ContainerLog[]) console.log(formatLog(log));
    }
    if (result.total > result.items.length) {
      console.error(`Showing ${result.items.length} of ${result.total} entries. Adjust --order to view the opposite end.`);
    }
  },
};

function positional(args: string[]): string | undefined {
  for (let index = 0; index < args.length; index++) {
    if (args[index] === "--order" || args[index] === "--limit") {
      index += 1;
      continue;
    }
    if (!args[index]!.startsWith("-")) return args[index];
  }
  return undefined;
}

function parseLimit(raw: string | undefined): number {
  if (raw === undefined) return 200;
  const limit = Number(raw);
  if (!Number.isSafeInteger(limit) || limit < 1) {
    throw new SiimitError("--limit must be a positive integer.");
  }
  return limit;
}

function parseOrder(raw: string | undefined): LogOrder {
  if (raw === undefined) return "asc";
  if (raw === "asc" || raw === "desc") return raw;
  throw new SiimitError("--order must be asc or desc.");
}

function formatLog(log: ContainerLog): string {
  const prefix = [log.timestamp, log.podName].filter(Boolean).map((value) => `[${value}]`).join(" ");
  return prefix ? `${prefix} ${log.message}` : log.message;
}

function formatEvent(event: JobEvent): string {
  const prefix = [event.lastTimestamp, event.type, event.reason, event.objectId]
    .filter(Boolean)
    .map((value) => `[${value}]`)
    .join(" ");
  return prefix ? `${prefix} ${event.message}` : event.message;
}
