import { chmod, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { z } from "zod";

import { ConfigurationError } from "./errors";

export const DEFAULT_BASE_URL = "https://qz.sii.edu.cn";

const appConfigSchema = z.object({
  workspace: z.string().min(1).default("分布式训练空间"),
  nodes: z.number().int().positive().default(1),
  framework: z.string().min(1).default("pytorch"),
});

export type AppConfig = z.infer<typeof appConfigSchema>;
export const DEFAULT_APP_CONFIG: AppConfig = appConfigSchema.parse({});

function configDir(): string {
  if (process.env.SIIMIT_CONFIG_DIR) return process.env.SIIMIT_CONFIG_DIR;
  const root = process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config");
  return join(root, "siimit");
}

function sessionPath(): string {
  return join(configDir(), "session.json");
}

function credentialsPath(): string {
  return join(configDir(), "credentials.json");
}

export function appConfigPath(): string {
  return join(configDir(), "config.json");
}

export async function loadAppConfig(path = appConfigPath()): Promise<AppConfig> {
  try {
    return appConfigSchema.parse(JSON.parse(await readFile(path, "utf8")));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw new ConfigurationError(`Cannot read siimit config: ${errorMessage(error)}`);
    }
    await writePrivateJson(path, DEFAULT_APP_CONFIG);
    return DEFAULT_APP_CONFIG;
  }
}

export async function removeSession(): Promise<void> {
  await rm(sessionPath(), { force: true });
}

export async function removeCredentials(): Promise<void> {
  await rm(credentialsPath(), { force: true });
}

async function writePrivateJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, path);
  await chmod(path, 0o600);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
