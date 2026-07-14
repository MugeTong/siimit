import {
  DEFAULT_BASE_URL,
  loadAppConfig,
  removeCredentials,
  removeSession,
  saveCredentials,
  saveSession,
} from "../../config";
import { loginHttp } from "../../platform/auth";
import { option } from "../args";
import { ask, askHidden } from "../prompts";

export async function runLogin(args: string[]): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) {
    console.log("Usage: siimit login [--username ID] [--base-url URL]\n\nAuthenticate and save credentials for automatic session renewal.");
    return;
  }
  await loadAppConfig();
  const username = option(args, "--username") ?? process.env.INSPIRE_USERNAME ?? await ask("Username");
  const password = process.env.INSPIRE_PASSWORD ?? await askHidden("Password");
  const baseUrl = option(args, "--base-url") ?? process.env.INSPIRE_BASE_URL ?? DEFAULT_BASE_URL;
  const session = await loginHttp({ username, password, baseUrl });
  await saveSession(session);
  await saveCredentials({ username, password, base_url: baseUrl });
  console.log("Login successful.");
}

export async function runLogout(args: string[]): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) {
    console.log("Usage: siimit logout [--forget]\n\nClear the session. Use --forget to also remove saved credentials.");
    return;
  }
  await removeSession();
  if (args.includes("--forget")) await removeCredentials();
  console.log(args.includes("--forget") ? "Logged out and forgot saved credentials." : "Logged out.");
}
