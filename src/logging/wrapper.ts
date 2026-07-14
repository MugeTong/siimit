import { chmod, mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join } from "node:path";

import { ConfigurationError } from "../errors";

export interface LogWrapper {
  path: string;
  script: string;
  command: string;
}

export function expandLogFileTemplate(template: string, name: string, now = new Date()): string {
  const timestamp = now.toISOString().replaceAll(":", "-");
  return template.replaceAll("{name}", name).replaceAll("{timestamp}", timestamp);
}

export function buildLogWrapper(logFile: string, command: string, append: boolean): LogWrapper {
  if (!isAbsolute(logFile)) {
    throw new ConfigurationError("--log-file must be an absolute path on a shared filesystem.");
  }
  const stem = basename(logFile).replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = join(dirname(logFile), ".siimit", "wrappers", `${stem}.sh`);
  const redirect = append ? ">>" : ">";
  const script = `#!/usr/bin/env bash\nlog_file=${shellQuote(logFile)}\nnode=\${HOSTNAME:-unknown}\nrank=\${RANK:-\${LOCAL_RANK:-0}}\nlog_file=\${log_file//\\{node\\}/$node}\nlog_file=\${log_file//\\{rank\\}/$rank}\nlog_dir=\${log_file%/*}\nif [ "$log_dir" != "$log_file" ]; then mkdir -p -- "$log_dir" || exit; fi\nexec bash -c ${shellQuote(command)} ${redirect}"$log_file" 2>&1\n`;
  return { path, script, command: `bash ${shellQuote(path)}` };
}

export async function writeLogWrapper(wrapper: LogWrapper): Promise<void> {
  await mkdir(dirname(wrapper.path), { recursive: true, mode: 0o700 });
  await writeFile(wrapper.path, wrapper.script, { mode: 0o700 });
  await chmod(wrapper.path, 0o700);
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
