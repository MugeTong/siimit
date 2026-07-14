import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { configDir } from "../config";

interface JobMetadata {
  log_file?: string;
}

function metadataPath(): string {
  return join(configDir(), "jobs.json");
}

export async function saveJobMetadata(jobId: string, metadata: JobMetadata): Promise<void> {
  const path = metadataPath();
  let current: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(await readFile(path, "utf8"));
    if (isRecord(parsed)) current = parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  current[jobId] = metadata;
  await writePrivateJson(path, current);
}

export async function loadJobMetadata(jobId: string): Promise<JobMetadata> {
  try {
    const parsed: unknown = JSON.parse(await readFile(metadataPath(), "utf8"));
    if (!isRecord(parsed) || !isRecord(parsed[jobId])) return {};
    const logFile = parsed[jobId].log_file;
    return typeof logFile === "string" ? { log_file: logFile } : {};
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw error;
  }
}

async function writePrivateJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, path);
  await chmod(path, 0o600);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
