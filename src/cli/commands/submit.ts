import { access } from "node:fs/promises";

import { InspireClient } from "../../platform/client";
import { loadAppConfig } from "../../config";
import { AuthenticationError } from "../../errors";
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

  let client = new InspireClient(await sessionOrLogin());
  let payload: Record<string, unknown>;
  try {
    payload = await buildSubmissionPayload(client, options, appConfig);
  } catch (error) {
    if (!(error instanceof AuthenticationError)) throw error;
    client = new InspireClient(await loginWithSavedCredentials());
    payload = await buildSubmissionPayload(client, options, appConfig);
  }

  if (args.includes("--dry-run")) {
    if (args.includes("--json")) {
      return emit({ dry_run: true, payload });
    }
    console.log(renderDryRunSummary(options, payload));
    return;
  }

  const submission = await client.submit(payload);
  const framework = firstFramework(submission.result.framework_config)
    ?? firstFramework(payload.framework_config);
  emit({
    submitted: true,
    job_id: submission.jobId ?? null,
    status: String(submission.result.status ?? "job_queuing").replace(/^job_/, "").toUpperCase(),
    resource: formatFrameworkResource(framework),
    task_priority: payload.task_priority,
  });
}

function renderDryRunSummary(
  options: ReturnType<typeof parseSubmitOptions>,
  payload: Record<string, unknown>,
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
    `Command: ${options.command}`,
    "",
    "Use --dry-run --json to print the complete platform payload.",
  ].join("\n");
}

function emit(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}
