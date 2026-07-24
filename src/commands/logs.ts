import { SiimitError } from "../errors";
import { InstanceNotReadyError } from "../platform/train";
import {
  getContainerLogs,
  getJobEvents,
  isBenignPlatformEvent,
  isPlatformHeartbeat,
  type JobEvent,
  type JobEventScope,
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
  usage: "siimit logs <job-id> [--events [--scope all|job|instance]] [--system] [--order asc|desc] [--limit NUMBER | --all] [--json]",
  valueOptions: ["--order", "--limit", "--scope"],
  flagOptions: ["--events", "--system", "--all", "--json"],
  maxPositionals: 1,
  details: [
    "Options:",
    "  --events        Show platform and Kubernetes events instead of container output",
    "  --scope SCOPE   Event scope: instance, job, or all (default: instance)",
    "  --system        Include hidden platform heartbeat and bookkeeping entries",
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
    if (option(args, "--scope") !== undefined && !args.includes("--events")) {
      throw new SiimitError("--scope requires --events.");
    }
    const limit = all ? undefined : parseLimit(requestedLimit);
    const order = parseOrder(option(args, "--order"));
    const scope = parseScope(option(args, "--scope"));
    let result;
    try {
      result = args.includes("--events")
        ? await withClient((client) => getJobEvents(client, jobId, limit ?? 200, order, scope))
        : await withClient((client) => getContainerLogs(client, jobId, limit, order));
    } catch (error) {
      if (!(error instanceof InstanceNotReadyError)) throw error;
      throw new SiimitError(
        "No container instance is available yet. Use --events to inspect scheduling progress.",
      );
    }
    if (args.includes("--json")) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    if (result.kind === "events") {
      const events = result.items as JobEvent[];
      if (events.length === 0) {
        console.error("No scheduling events yet.");
        return;
      }
      const visible = args.includes("--system")
        ? events
        : events.filter((event) => !isBenignPlatformEvent(event));
      const showSource = new Set(visible.map((event) => event.objectId)).size > 1;
      for (const event of visible) console.log(formatEvent(event, showSource));
      reportHidden(events.length - visible.length, "benign platform event");
    } else {
      const logs = result.items as ContainerLog[];
      if (logs.length === 0) {
        console.error("No container logs yet. Use --events to inspect scheduling and image-pull progress.");
        return;
      }
      const visible = args.includes("--system") ? logs : logs.filter((log) => !isPlatformHeartbeat(log));
      const showSource = new Set(visible.map((log) => log.podName)).size > 1;
      for (const log of visible) console.log(formatLog(log, showSource));
      reportHidden(logs.length - visible.length, "platform heartbeat line");
    }
    if (result.total > result.items.length) {
      console.error(`Showing ${result.items.length} of ${result.total} entries. Adjust --order to view the opposite end.`);
    }
  },
};

function positional(args: string[]): string | undefined {
  for (let index = 0; index < args.length; index++) {
    if (args[index] === "--order" || args[index] === "--limit" || args[index] === "--scope") {
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

function parseScope(raw: string | undefined): JobEventScope {
  if (raw === undefined) return "instance";
  if (raw === "all" || raw === "job" || raw === "instance") return raw;
  throw new SiimitError("--scope must be all, job, or instance.");
}

function formatLog(log: ContainerLog, showSource: boolean): string {
  const prefix = [log.timestamp, showSource ? shortSource(log.podName) : ""]
    .filter(Boolean)
    .map((value) => `[${value}]`)
    .join(" ");
  return prefix ? `${prefix} ${log.message}` : log.message;
}

function formatEvent(event: JobEvent, showSource: boolean): string {
  const prefix = [
    event.lastTimestamp,
    showSource ? shortSource(event.objectId) : "",
    event.reason,
  ]
    .filter(Boolean)
    .map((value) => `[${value}]`)
    .join(" ");
  return prefix ? `${prefix} ${event.message}` : event.message;
}

function shortSource(value: string): string {
  const worker = value.match(/worker-\d+$/)?.[0];
  return worker ?? (value.startsWith("job-") ? "job" : value);
}

function reportHidden(count: number, description: string): void {
  if (count > 0) {
    console.error(`Hidden ${count} ${description}${count === 1 ? "" : "s"}. Use --system to show them.`);
  }
}
