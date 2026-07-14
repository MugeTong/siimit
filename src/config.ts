import { chmod, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { z } from "zod";

import { ConfigurationError } from "./errors";

export const DEFAULT_BASE_URL = "https://qz.sii.edu.cn";

const storageCookieSchema = z.object({
  name: z.string().min(1),
  value: z.string(),
  domain: z.string().optional(),
  path: z.string().default("/"),
  expires: z.number().optional(),
  httpOnly: z.boolean().optional(),
  secure: z.boolean().optional(),
  sameSite: z.string().optional(),
});

export const browserSessionSchema = z.object({
  base_url: z.string().url(),
  username: z.string().nullable().optional(),
  created_at: z.number().default(() => Date.now() / 1000),
  storage_state: z.object({
    cookies: z.array(storageCookieSchema),
    origins: z.array(z.unknown()).default([]),
  }),
  user_detail: z.record(z.string(), z.unknown()).nullable().optional(),
});

export type BrowserSession = z.infer<typeof browserSessionSchema>;
export type StorageCookie = z.infer<typeof storageCookieSchema>;

const credentialsSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  base_url: z.string().url().default(DEFAULT_BASE_URL),
});

export type Credentials = z.infer<typeof credentialsSchema>;

export const appConfigSchema = z.object({
  workspace: z.string().min(1).default("分布式训练空间"),
  image_visibility: z.literal("VISIBILITY_PRIVATE").default("VISIBILITY_PRIVATE"),
  image_sources: z.array(z.string()).default(["SOURCE_PRIVATE", "SOURCE_PUBLIC"]),
  nodes: z.number().int().positive().default(1),
  framework: z.string().min(1).default("pytorch"),
  priority_strategy: z.literal("project_max").default("project_max"),
  quota_strategy: z.literal("max_resources_for_gpu_count").default("max_resources_for_gpu_count"),
  nominal_cpu_per_gpu: z.number().positive().default(20),
  nominal_memory_gib_per_gpu: z.number().positive().default(200),
});

export type AppConfig = z.infer<typeof appConfigSchema>;
export const DEFAULT_APP_CONFIG: AppConfig = appConfigSchema.parse({});

export function configDir(): string {
  if (process.env.SIIMIT_CONFIG_DIR) return process.env.SIIMIT_CONFIG_DIR;
  const root = process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config");
  return join(root, "siimit");
}

export function sessionPath(): string {
  return join(configDir(), "session.json");
}

export function credentialsPath(): string {
  return join(configDir(), "credentials.json");
}

export function appConfigPath(): string {
  return join(configDir(), "config.json");
}

export async function saveSession(session: BrowserSession, path = sessionPath()): Promise<string> {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${JSON.stringify(session, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, path);
  await chmod(path, 0o600);
  return path;
}

export async function loadSession(path = sessionPath()): Promise<BrowserSession> {
  try {
    return browserSessionSchema.parse(JSON.parse(await readFile(path, "utf8")));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new ConfigurationError("No cached session. Run `siimit login` first.");
    }
    throw new ConfigurationError(`Cannot read cached session at ${path}: ${errorMessage(error)}`);
  }
}

export async function saveCredentials(
  credentials: Credentials,
  path = credentialsPath(),
): Promise<void> {
  await writePrivateJson(path, credentialsSchema.parse(credentials));
}

export async function loadCredentials(path = credentialsPath()): Promise<Credentials> {
  try {
    return credentialsSchema.parse(JSON.parse(await readFile(path, "utf8")));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new ConfigurationError("No saved credentials. Run `siimit login` first.");
    }
    throw new ConfigurationError(`Cannot read saved credentials: ${errorMessage(error)}`);
  }
}

export async function loadAppConfig(path = appConfigPath()): Promise<AppConfig> {
  try {
    const raw = JSON.parse(await readFile(path, "utf8"));
    return appConfigSchema.parse(raw);
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
