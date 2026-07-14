import { isAbsolute } from "node:path";

import { ConfigurationError } from "../errors";

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
