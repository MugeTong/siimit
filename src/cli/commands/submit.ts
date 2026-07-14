import { access } from "node:fs/promises";

import { InspireClient } from "../../platform/client";
import { loadAppConfig } from "../../config";
import { AuthenticationError, SiimitError } from "../../errors";
import { buildLoggedCommand, expandLogFileTemplate } from "../../logging/wrapper";
import { buildSubmissionPayload } from "../../submission";
import { option, parseSubmitOptions } from "../args";
import { printSubmitHelp } from "../help";
import { loginWithSavedCredentials, sessionOrLogin } from "../runtime";
import { firstFramework, formatFrameworkResource } from "../../shared/resource";

export async function runSubmit(args: string[]): Promise<void> {
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

  const { logFile: _logFile, appendLog: _appendLog, ...baseOptions } = options;
  const resolvedOptions = {
    ...baseOptions,
    ...(logFile ? { command: buildLoggedCommand(logFile, options.command, options.appendLog === true) } : {}),
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

  if (args.includes("--dry-run")) {
    if (args.includes("--json")) {
      return emit({
        dry_run: true,
        log_file: logFile ?? null,
        append_log: options.appendLog === true,
        payload,
      });
    }
    console.log(renderDryRunSummary(options, payload, logFile));
    return;
  }

  const submission = await client.submit(payload);
  const framework = firstFramework(submission.result.framework_config)
    ?? firstFramework(payload.framework_config);
  emit({
    submitted: true,
    job_id: submission.jobId ?? null,
    status: String(submission.result.status ?? "job_queuing").replace(/^job_/, "").toUpperCase(),
    log_file: logFile ?? null,
    resource: formatFrameworkResource(framework),
    task_priority: payload.task_priority,
  });
}

function renderDryRunSummary(
  options: ReturnType<typeof parseSubmitOptions>,
  payload: Record<string, unknown>,
  logFile: string | undefined,
): string {
  const framework = firstFramework(payload.framework_config) ?? {};
  const nodes = Number(framework.instance_count ?? 1);
  const resource = formatFrameworkResource(framework);
  const image = String(framework.image ?? options.image);
  const cpu = Number(framework.cpu ?? 0);
  const memory = Number(framework.mem_gi ?? 0);
  return [
    "Dry run successful. No task was submitted.",
    `Project: ${options.project}`,
    `Group: ${options.group}`,
    `Resource: ${nodes > 1 ? `${nodes} nodes × ` : ""}${resource}, ${cpu} CPU, ${memory} GiB per node`,
    `Priority: ${String(payload.task_priority ?? "platform default")}`,
    `Image: ${image}`,
    `Max time: ${options.maxTimeHours} hour(s)`,
    `Log: ${logFile ?? "disabled"}`,
    `Command: ${options.command}`,
    "",
    "Use --dry-run --json to print the complete platform payload.",
  ].join("\n");
}

function emit(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}
