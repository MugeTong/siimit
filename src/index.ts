#!/usr/bin/env bun
import { access } from "node:fs/promises";
import { loginHttp } from "./auth";
import { getDistributedTrainingCapacity, renderCapacity } from "./capacity";
import { InspireClient } from "./client";
import {
  DEFAULT_BASE_URL,
  loadAppConfig,
  loadCredentials,
  loadJobMetadata,
  loadSession,
  removeCredentials,
  removeSession,
  saveCredentials,
  saveJobMetadata,
  saveSession,
  type BrowserSession,
} from "./config";
import { AuthenticationError, ConfigurationError, SiimitError } from "./errors";
import { listCurrentUserJobs, renderJobs } from "./jobs";
import { cancelJob, getJob, removeJob, renderJob, validateJobId } from "./job-actions";
import { listParticipatingProjects, renderProjects } from "./projects";
import { ask, askHidden } from "./prompts";
import { buildLogWrapper, buildSubmissionPayload, commandFileCommand, expandLogFileTemplate, writeLogWrapper, type LogWrapper, type SubmitOptions } from "./submission";
import packageInfo from "../package.json";

const VERSION = packageInfo.version;

async function main(args: string[]): Promise<void> {
  const [command, ...rest] = args;
  if (!command || command === "--help" || command === "-h") return printHelp();
  if (command === "--version" || command === "-V" || command === "version") return console.log(VERSION);
  if (command === "login") return loginCommand(rest);
  if (command === "logout") return logoutCommand(rest);
  if (command === "submit") return submitCommand(rest);
  if (command === "ls") return listCommand(rest);
  if (command === "groups") return groupsCommand(rest);
  if (command === "projects") return projectsCommand(rest);
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

async function submitCommand(args: string[]): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) return printSubmitHelp();
  const options = parseSubmitOptions(args);
  const commandFile = option(args, "--command-file");
  if (commandFile) await access(commandFile);
  const appConfig = await loadAppConfig();
  const logTemplate = options.logFile ?? appConfig.log_file;
  if (options.appendLog && !logTemplate) {
    throw new SiimitError("--append-log requires --log-file or config.log_file.");
  }
  const logFile = logTemplate ? expandLogFileTemplate(logTemplate, options.name) : undefined;
  const nodes = options.nodes ?? appConfig.nodes;
  if (logFile && nodes > 1 && !logFile.includes("{node}") && !logFile.includes("{rank}")) {
    throw new SiimitError("Multi-node logging requires {node} or {rank} in --log-file to prevent concurrent writes.");
  }
  let wrapper: LogWrapper | undefined;
  if (logFile) wrapper = buildLogWrapper(logFile, options.command, options.appendLog === true);
  const { logFile: _logFile, appendLog: _appendLog, ...baseOptions } = options;
  const resolvedOptions: SubmitOptions = {
    ...baseOptions,
    ...(wrapper ? { command: wrapper.command } : {}),
  };
  let client = new InspireClient(await sessionOrLogin());
  let payload: Record<string, unknown>;
  try {
    payload = await buildSubmissionPayload(client, resolvedOptions, appConfig);
  } catch (error) {
    if (!(error instanceof AuthenticationError)) throw error;
    client = new InspireClient(await loginWithSavedCredentials());
    payload = await buildSubmissionPayload(client, resolvedOptions, appConfig);
  }
  if (args.includes("--dry-run")) return emit({
    dry_run: true,
    log_file: logFile ?? null,
    wrapper_file: wrapper?.path ?? null,
    append_log: resolvedOptions.appendLog === true,
    payload,
  });
  if (wrapper) await writeLogWrapper(wrapper);
  const submission = await client.submit(payload);
  if (submission.jobId && logFile) {
    await saveJobMetadata(submission.jobId, { log_file: logFile });
  }
  const framework = Array.isArray(payload.framework_config)
    ? payload.framework_config[0] as Record<string, unknown> | undefined
    : undefined;
  const resourceSpec = framework?.resource_spec_price as Record<string, unknown> | undefined;
  const gpuCount = Number(framework?.gpu_count ?? 0);
  const gpuType = String(resourceSpec?.gpu_type ?? "GPU").replace(/^NVIDIA_/, "").replaceAll("_", " ");
  emit({
    submitted: true,
    job_id: submission.jobId ?? null,
    status: String(submission.result.status ?? "job_queuing").replace(/^job_/, "").toUpperCase(),
    log_file: logFile ?? null,
    resource: gpuCount > 0 ? `${gpuCount}x${gpuType}` : "CPU",
    task_priority: payload.task_priority,
  });
}

async function listCommand(args: string[]): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) return printListHelp();
  const options = {
    ...(option(args, "--workspace") ? { workspace: option(args, "--workspace")! } : {}),
    ...(option(args, "--status") ? { status: option(args, "--status")! } : {}),
    ...(option(args, "--keyword") ? { keyword: option(args, "--keyword")! } : {}),
    limit: numericOption(args, "--limit", 20),
  };
  let rows;
  try {
    rows = await listCurrentUserJobs(new InspireClient(await sessionOrLogin()), options);
  } catch (error) {
    if (!(error instanceof AuthenticationError)) throw error;
    rows = await listCurrentUserJobs(
      new InspireClient(await loginWithSavedCredentials()),
      options,
    );
  }
  if (args.includes("--json")) emit(rows);
  else console.log(renderJobs(rows));
}

async function groupsCommand(args: string[]): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) return printGroupsHelp();
  const project = option(args, "--project") ?? option(args, "-p");
  let rows;
  try {
    rows = await getDistributedTrainingCapacity(
      new InspireClient(await sessionOrLogin()),
      project,
    );
  } catch (error) {
    if (!(error instanceof AuthenticationError)) throw error;
    rows = await getDistributedTrainingCapacity(
      new InspireClient(await loginWithSavedCredentials()),
      project,
    );
  }
  if (args.includes("--json")) emit(rows);
  else console.log(renderCapacity(rows));
}

async function projectsCommand(args: string[]): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) return printProjectsHelp();
  let rows;
  try {
    rows = await listParticipatingProjects(new InspireClient(await sessionOrLogin()));
  } catch (error) {
    if (!(error instanceof AuthenticationError)) throw error;
    rows = await listParticipatingProjects(
      new InspireClient(await loginWithSavedCredentials()),
    );
  }
  if (args.includes("--json")) emit(rows);
  else console.log(renderProjects(rows));
}

async function cancelCommand(args: string[]): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) {
    console.log("Usage: siimit cancel <job-id>\n\nStop a running or queued training job.");
    return;
  }
  const jobId = validateJobId(args[0]);
  const result = await runAuthenticatedMutation(
    (client) => cancelJob(client, jobId),
  );
  emit({ cancelled: true, job_id: jobId, result });
}

async function removeCommand(args: string[]): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) {
    console.log("Usage: siimit remove <job-id>\n\nPermanently delete a stopped or completed training job record.");
    return;
  }
  const jobId = validateJobId(args[0]);
  const result = await runAuthenticatedMutation(
    (client) => removeJob(client, jobId),
  );
  emit({ removed: true, job_id: jobId, ...result });
}

async function getCommand(args: string[]): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) {
    console.log("Usage: siimit get <job-id> [--json | --raw]\n\nShow normalized task state. Use --raw only when the complete platform response is needed.");
    return;
  }
  const jobId = validateJobId(args[0]);
  let job;
  try {
    job = await getJob(new InspireClient(await sessionOrLogin()), jobId);
  } catch (error) {
    if (!(error instanceof AuthenticationError)) throw error;
    job = await getJob(new InspireClient(await loginWithSavedCredentials()), jobId);
  }
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

async function runAuthenticatedMutation(
  operation: (client: InspireClient) => Promise<Record<string, unknown>>,
): Promise<Record<string, unknown>> {
  try {
    return await operation(new InspireClient(await sessionOrLogin()));
  } catch (error) {
    if (!(error instanceof AuthenticationError)) throw error;
    return operation(new InspireClient(await loginWithSavedCredentials()));
  }
}

async function sessionOrLogin(): Promise<BrowserSession> {
  try {
    return await loadSession();
  } catch (error) {
    if (!(error instanceof ConfigurationError)) throw error;
    return loginWithSavedCredentials();
  }
}

async function loginWithSavedCredentials(): Promise<BrowserSession> {
  const credentials = await loadCredentials();
  const session = await loginHttp({
    username: credentials.username,
    password: credentials.password,
    baseUrl: credentials.base_url,
  });
  await saveSession(session);
  return session;
}

function parseSubmitOptions(args: string[]): SubmitOptions {
  const inlineCommand = option(args, "--command") ?? option(args, "-c");
  const commandFile = option(args, "--command-file");
  if (inlineCommand && commandFile) throw new SiimitError("Use either --command or --command-file, not both.");
  if (!inlineCommand && !commandFile) throw new SiimitError("--command or --command-file is required.");
  return {
    name: requiredOption(args, "--name", "-n"),
    command: commandFile ? commandFileCommand(commandFile) : inlineCommand!,
    project: requiredOption(args, "--project", "-p"),
    group: requiredOption(args, "--group"),
    gpus: requiredNumericOption(args, "--gpus"),
    ...optionalPositiveInteger(args, "--nodes", "nodes"),
    image: requiredOption(args, "--image"),
    ...optionalNumber(args, "--max-time", "maxTimeHours"),
    ...optionalNumber(args, "--shm-size", "shmSizeGiB"),
    ...(option(args, "--log-file") ? { logFile: option(args, "--log-file")! } : {}),
    appendLog: args.includes("--append-log"),
    excludeNodes: repeatedOption(args, "--exclude-node"),
  };
}

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function requiredOption(args: string[], name: string, alias?: string): string {
  const value = option(args, name) ?? (alias ? option(args, alias) : undefined);
  if (!value) throw new SiimitError(`${name} is required.`);
  return value;
}

function numericOption(args: string[], name: string, fallback: number): number {
  const raw = option(args, name);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new SiimitError(`${name} must be a number.`);
  return value;
}

function requiredNumericOption(args: string[], name: string): number {
  const raw = requiredOption(args, name);
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new SiimitError(`${name} must be a positive integer.`);
  }
  return value;
}

function optionalNumber<K extends string>(
  args: string[],
  name: string,
  key: K,
): { [P in K]?: number } {
  const raw = option(args, name);
  if (raw === undefined) return {};
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new SiimitError(`${name} must be a number.`);
  return { [key]: value } as { [P in K]?: number };
}

function optionalPositiveInteger<K extends string>(
  args: string[],
  name: string,
  key: K,
): { [P in K]?: number } {
  const raw = option(args, name);
  if (raw === undefined) return {};
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new SiimitError(`${name} must be a positive integer.`);
  }
  return { [key]: value } as { [P in K]?: number };
}

function repeatedOption(args: string[], name: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < args.length; index++) {
    if (args[index] === name && args[index + 1]) values.push(args[index + 1]!);
  }
  return values;
}

function emit(value: unknown): void { console.log(JSON.stringify(value, null, 2)); }

function printHelp(): void {
  console.log(`siimit ${VERSION}\n\nUsage:\n  siimit version\n  siimit login [--username ID] [--base-url URL]\n  siimit logout [--forget]\n  siimit groups [--json]\n  siimit projects [--json]\n  siimit ls [OPTIONS]\n  siimit get <job-id> [--json]\n  siimit submit [OPTIONS]\n  siimit cancel <job-id>\n  siimit remove <job-id>\n\nRun a command with --help for details.\n\nEnvironment:\n  INSPIRE_USERNAME  Platform login ID\n  INSPIRE_PASSWORD  Platform password\n  INSPIRE_BASE_URL  Platform URL (default: ${DEFAULT_BASE_URL})\n  SIIMIT_CONFIG_DIR Override ~/.config/siimit`);
}

function printGroupsHelp(): void {
  console.log(`Usage: siimit groups [--project PROJECT] [--json]\n\nShow GPU compute groups and live capacity for 分布式训练空间 only.\nUse --project (or -p) to show GPU sizes allowed for that project at its maximum priority.\n\nColumns:\n  GPU SIZES      Per-node GPU counts allowed for the selected project\n  FREE           Unused GPUs (never negative)\n  OVERCOMMITTED  Usage beyond reported total\n  PREEMPTIBLE    GPUs occupied by low-priority jobs\n  HIGH PRI       Capacity potentially available to high-priority jobs after preemption\n  USED           Currently used GPUs\n  TOTAL          Total GPUs reported by the platform`);
}

function printProjectsHelp(): void {
  console.log(`Usage: siimit projects [--json]\n\nList projects visible to the current user, including maximum priority and available point-balance fields reported by the platform.`);
}

function printListHelp(): void {
  console.log(`Usage: siimit ls [OPTIONS]\n\nList the current user's training jobs across accessible workspaces.\n\nOptions:\n  --workspace NAME    Exact workspace name or ws-... ID\n  --status STATUS     RUNNING, QUEUING, SUCCEEDED, FAILED, CANCELLED, or API value\n  --keyword TEXT      Server-side keyword filter\n  --limit NUMBER      Maximum rows after merging workspaces (default: 20)\n  --json              Print structured JSON\n  -h, --help          Show this help`);
}

function printSubmitHelp(): void {
  console.log(`Usage: siimit submit [OPTIONS]\n\nRequired:\n  -n, --name NAME              Job name\n  -c, --command COMMAND        Inline start command\n      --command-file PATH      Absolute shared script path (instead of --command)\n  -p, --project PROJECT        Exact participating project name or project-... ID\n      --group GROUP            Exact GPU compute group name or lcg-... ID\n      --gpus NUMBER            GPUs per node\n      --image IMAGE            Private image name:version or full address\n\nOptional:\n      --nodes NUMBER           Number of nodes (default from config: 1)\n      --max-time HOURS         Maximum runtime\n      --shm-size GIB           Shared memory per instance\n      --log-file PATH          Absolute shared log path; supports {name}, {timestamp}, {node}, {rank}\n      --append-log             Append instead of overwriting the log file\n      --exclude-node NAME      Exclude a node; repeat as needed\n      --dry-run                Resolve and print payload without submitting\n\nLogging creates a wrapper script beside the log under .siimit/wrappers/.\nMulti-node logging requires {node} or {rank}. Total GPUs = --gpus × --nodes.`);
}

main(process.argv.slice(2)).catch((error: unknown) => {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
