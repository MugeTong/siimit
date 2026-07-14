import { chmod, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { configDir } from "../config";

interface JobMetadata {
  log_file?: string;
  wrapper_file?: string;
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
    const wrapperFile = parsed[jobId].wrapper_file;
    return {
      ...(typeof logFile === "string" ? { log_file: logFile } : {}),
      ...(typeof wrapperFile === "string" ? { wrapper_file: wrapperFile } : {}),
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw error;
  }
}

export async function removeJobArtifacts(jobId: string): Promise<void> {
  const path = metadataPath();
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  if (!isRecord(parsed)) return;
  const metadata = isRecord(parsed[jobId]) ? parsed[jobId] : undefined;
  if (typeof metadata?.wrapper_file === "string") {
    await rm(metadata.wrapper_file, { force: true }).catch(() => {});
  }
  delete parsed[jobId];
  await writePrivateJson(path, parsed);
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
