import { SiimitError } from "../errors";
import type { SubmitOptions } from "../submission";
import { commandFileCommand } from "../logging/wrapper";

export function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

export function parseSubmitOptions(args: string[]): SubmitOptions {
  const inlineCommand = option(args, "--command") ?? option(args, "-c");
  const commandFile = option(args, "--command-file");
  if (inlineCommand && commandFile) throw new SiimitError("Use either --command or --command-file, not both.");
  const missing = [
    ...(!(option(args, "--name") ?? option(args, "-n")) ? ["--name"] : []),
    ...(!inlineCommand && !commandFile ? ["--command or --command-file"] : []),
    ...(!(option(args, "--project") ?? option(args, "-p")) ? ["--project"] : []),
    ...(!option(args, "--group") ? ["--group"] : []),
    ...(!option(args, "--gpus") ? ["--gpus"] : []),
    ...(!option(args, "--image") ? ["--image"] : []),
  ];
  if (missing.length) {
    throw new SiimitError(
      `Missing required options:\n${missing.map((name) => `  ${name}`).join("\n")}\n\nRun 'siimit submit --help' for usage.`,
    );
  }
  return {
    name: requiredOption(args, "--name", "-n"),
    command: commandFile ? commandFileCommand(commandFile) : inlineCommand!,
    project: requiredOption(args, "--project", "-p"),
    group: requiredOption(args, "--group"),
    gpus: requiredPositiveInteger(args, "--gpus"),
    ...optionalPositiveInteger(args, "--nodes", "nodes"),
    image: requiredOption(args, "--image"),
    ...optionalNumber(args, "--max-time", "maxTimeHours"),
    ...optionalNumber(args, "--shm-size", "shmSizeGiB"),
    ...(option(args, "--log-file") ? { logFile: option(args, "--log-file")! } : {}),
    appendLog: args.includes("--append-log"),
    excludeNodes: repeatedOption(args, "--exclude-node"),
  };
}

export function numericOption(args: string[], name: string, fallback: number): number {
  const raw = option(args, name);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new SiimitError(`${name} must be a number.`);
  return value;
}

function requiredOption(args: string[], name: string, alias?: string): string {
  const value = option(args, name) ?? (alias ? option(args, alias) : undefined);
  if (!value) throw new SiimitError(`${name} is required.`);
  return value;
}

function requiredPositiveInteger(args: string[], name: string): number {
  const value = Number(requiredOption(args, name));
  if (!Number.isInteger(value) || value < 1) throw new SiimitError(`${name} must be a positive integer.`);
  return value;
}

function optionalNumber<K extends string>(args: string[], name: string, key: K): { [P in K]?: number } {
  const raw = option(args, name);
  if (raw === undefined) return {};
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new SiimitError(`${name} must be a number.`);
  return { [key]: value } as { [P in K]?: number };
}

function optionalPositiveInteger<K extends string>(args: string[], name: string, key: K): { [P in K]?: number } {
  const raw = option(args, name);
  if (raw === undefined) return {};
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) throw new SiimitError(`${name} must be a positive integer.`);
  return { [key]: value } as { [P in K]?: number };
}

function repeatedOption(args: string[], name: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < args.length; index++) {
    if (args[index] === name && args[index + 1]) values.push(args[index + 1]!);
  }
  return values;
}
