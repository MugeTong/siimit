#!/usr/bin/env bun
import { loginHttp } from "./platform/auth";
import { getDistributedTrainingCapacity, renderCapacity } from "./capacity";
import {
  DEFAULT_BASE_URL,
  loadAppConfig,
  removeCredentials,
  removeSession,
  saveCredentials,
  saveSession,
} from "./config";
import { SiimitError } from "./errors";
import { loadJobMetadata } from "./storage/job-metadata";
import { listCurrentUserJobs, renderJobs } from "./jobs";
import { cancelJob, getJob, removeJob, renderJob, validateJobId } from "./job-actions";
import { listParticipatingProjects, renderProjects } from "./projects";
import { ask, askHidden } from "./prompts";
import packageInfo from "../package.json";
import { numericOption, option } from "./cli/args";
import { withMutationClient, withReadClient } from "./cli/runtime";
import { printGroupsHelp, printHelp, printListHelp, printProjectsHelp } from "./cli/help";
import { runSubmit } from "./cli/commands/submit";
import { runImages } from "./cli/commands/images";

const VERSION = packageInfo.version;

async function main(args: string[]): Promise<void> {
  const [command, ...rest] = args;
  if (!command || command === "--help" || command === "-h") return printHelp(VERSION);
  if (command === "--version" || command === "-V" || command === "version") return console.log(VERSION);
  if (command === "login") return loginCommand(rest);
  if (command === "logout") return logoutCommand(rest);
  if (command === "submit") return runSubmit(rest);
  if (command === "ls") return listCommand(rest);
  if (command === "groups") return groupsCommand(rest);
  if (command === "projects") return projectsCommand(rest);
  if (command === "images") return runImages(rest);
  if (command === "cancel") return cancelCommand(rest);
  if (command === "remove") return removeCommand(rest);
  if (command === "get") return getCommand(rest);
  throw new SiimitError(`Unknown command: ${command}`);
}

async function loginCommand(args: string[]): Promise<void> {
  await loadAppConfig();
  const usernameOption = option(args, "--username") ?? process.env.INSPIRE_USERNAME;
  const baseUrl = option(args, "--base-url") ?? process.env.INSPIRE_BASE_URL ?? DEFAULT_BASE_URL;
  const username = usernameOption || await ask("Username");
  const password = process.env.INSPIRE_PASSWORD || await askHidden("Password");
  const session = await loginHttp({ username, password, baseUrl });
  await saveSession(session);
  await saveCredentials({ username, password, base_url: baseUrl });
  console.log("Login successful.");
}

async function logoutCommand(args: string[]): Promise<void> {
  await removeSession();
  if (args.includes("--forget")) await removeCredentials();
  console.log(args.includes("--forget") ? "Logged out and forgot saved credentials." : "Logged out.");
}

async function listCommand(args: string[]): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) return printListHelp();
  const options = {
    ...(option(args, "--workspace") ? { workspace: option(args, "--workspace")! } : {}),
    ...(option(args, "--status") ? { status: option(args, "--status")! } : {}),
    ...(option(args, "--keyword") ? { keyword: option(args, "--keyword")! } : {}),
    limit: numericOption(args, "--limit", 20),
  };
  const rows = await withReadClient((client) => listCurrentUserJobs(client, options));
  if (args.includes("--json")) emit(rows);
  else console.log(renderJobs(rows));
}

async function groupsCommand(args: string[]): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) return printGroupsHelp();
  const project = option(args, "--project") ?? option(args, "-p");
  const rows = await withReadClient((client) => getDistributedTrainingCapacity(client, project));
  if (args.includes("--json")) emit(rows);
  else console.log(renderCapacity(rows));
}

async function projectsCommand(args: string[]): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) return printProjectsHelp();
  const rows = await withReadClient(listParticipatingProjects);
  if (args.includes("--json")) emit(rows);
  else console.log(renderProjects(rows));
}

async function cancelCommand(args: string[]): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) {
    console.log("Usage: siimit cancel <job-id>\n\nStop a running or queued training job.");
    return;
  }
  const jobId = validateJobId(args[0]);
  const result = await withMutationClient((client) => cancelJob(client, jobId));
  emit({ cancelled: true, job_id: jobId, result });
}

async function removeCommand(args: string[]): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) {
    console.log("Usage: siimit remove <job-id>\n\nPermanently delete a stopped or completed training job record.");
    return;
  }
  const jobId = validateJobId(args[0]);
  const result = await withMutationClient((client) => removeJob(client, jobId));
  emit({ removed: true, job_id: jobId, ...result });
}

async function getCommand(args: string[]): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) {
    console.log("Usage: siimit get <job-id> [--json | --raw]\n\nShow normalized task state. Use --raw only when the complete platform response is needed.");
    return;
  }
  const jobId = validateJobId(args[0]);
  const job = await withReadClient((client) => getJob(client, jobId));
  if (args.includes("--raw")) return emit(job.raw);
  const metadata = await loadJobMetadata(jobId);
  if (args.includes("--json")) emit({
    jobId: job.jobId,
    name: job.name,
    status: job.status,
    project: job.project,
    resource: job.resource,
    task_priority: job.taskPriority,
    priority_level: job.priorityLevel,
    shm_gi: job.shmGiB,
    createdAt: job.createdAt,
    createdAtMs: job.createdAtMs,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    runningTime: job.runningTime,
    exit_code: job.exitCode,
    failure_reason: job.failureReason,
    node: job.node,
    log_file: metadata.log_file ?? null,
  });
  else console.log(renderJob(job));
}


function emit(value: unknown): void { console.log(JSON.stringify(value, null, 2)); }

main(process.argv.slice(2)).catch((error: unknown) => {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
