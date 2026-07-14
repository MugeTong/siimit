import { access, rm } from "node:fs/promises";

import { InspireClient } from "../../platform/client";
import { loadAppConfig } from "../../config";
import { saveJobMetadata } from "../../storage/job-metadata";
import { AuthenticationError, SiimitError } from "../../errors";
import { buildLogWrapper, expandLogFileTemplate, writeLogWrapper, type LogWrapper } from "../../logging/wrapper";
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

  let wrapper: LogWrapper | undefined;
  if (logFile) wrapper = buildLogWrapper(logFile, options.command, options.appendLog === true);
  const { logFile: _logFile, appendLog: _appendLog, ...baseOptions } = options;
  const resolvedOptions = { ...baseOptions, ...(wrapper ? { command: wrapper.command } : {}) };

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
    return emit({
      dry_run: true,
      log_file: logFile ?? null,
      wrapper_file: wrapper?.path ?? null,
      append_log: options.appendLog === true,
      payload,
    });
  }

  if (wrapper) await writeLogWrapper(wrapper);
  let submission;
  try {
    submission = await client.submit(payload);
  } catch (error) {
    if (wrapper) await rm(wrapper.path, { force: true }).catch(() => {});
    throw error;
  }
  if (submission.jobId && logFile) {
    await saveJobMetadata(submission.jobId, {
      log_file: logFile,
      ...(wrapper ? { wrapper_file: wrapper.path } : {}),
    });
  }
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

function emit(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}
