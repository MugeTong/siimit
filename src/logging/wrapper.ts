import { isAbsolute } from "node:path";

import { ConfigurationError } from "../errors";

export function expandLogFileTemplate(template: string, name: string, now = new Date()): string {
  const timestamp = now.toISOString().replaceAll(":", "-");
  return template.replaceAll("{name}", name).replaceAll("{timestamp}", timestamp);
}

export function buildLoggedCommand(logFile: string, command: string, append: boolean): string {
  if (!isAbsolute(logFile)) {
    throw new ConfigurationError("--log-file must be an absolute path on a shared filesystem.");
  }
  const redirect = append ? ">>" : ">";
  const marker = Buffer.from(logFile, "utf8").toString("base64");
  const runtimePath = shellDoubleQuote(logFile)
    .replaceAll("{node}", "${HOSTNAME:-unknown}")
    .replaceAll("{rank}", "${RANK:-${LOCAL_RANK:-0}}");
  const script = `: "siimit-log:${marker}"; log_file="${runtimePath}"; log_dir="\${log_file%/*}"; mkdir -p -- "$log_dir" || exit; {\n${command}\n} ${redirect}"$log_file" 2>&1`;
  return `bash -c ${shellQuote(script)}`;
}

export function extractLogFile(command: unknown): string | undefined {
  const marker = /siimit-log:([A-Za-z0-9+/=]+)/.exec(String(command ?? ""))?.[1];
  if (!marker) return undefined;
  try {
    return Buffer.from(marker, "base64").toString("utf8");
  } catch {
    return undefined;
  }
}

export function commandFileCommand(path: string): string {
  if (!isAbsolute(path)) {
    throw new ConfigurationError("--command-file must be an absolute path on a shared filesystem.");
  }
  return `bash ${shellQuote(path)}`;
}

export function wrapShellCommand(command: string): string {
  const trimmed = command.trim();
  if (/^(bash|sh|\/bin\/bash|\/bin\/sh) /.test(trimmed)) return command;
  return `bash -c ${shellQuote(command)}`;
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function shellDoubleQuote(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"').replaceAll("$", "\\$").replaceAll("`", "\\`");
}
