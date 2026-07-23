import {
  DEFAULT_BASE_URL,
  loadAppConfig,
  removeCredentials,
  removeSession,
  saveCredentials,
  saveSession,
} from "../config";
import { loginHttp } from "../platform/auth";
import type { Command } from "./command";
import { option } from "./args";
import { ask, askHidden } from "./prompts";

export const loginCommand: Command = {
  name: "login",
  short: "authenticate with the platform",
  description: "Log in and save credentials for automatic session renewal.",
  usage: "siimit login [--username ID] [--base-url URL]",
  valueOptions: ["--username", "--base-url"],
  details: [
    "Options:",
    "  --username ID     Platform login ID; prompts when omitted",
    "  --base-url URL    Platform URL; normally does not need to be changed",
    "  -h, --help        Show this help without starting login",
    "",
    "Most commands reuse an existing Siimit session or saved credentials automatically.",
    "Run login only when an authenticated command reports that no session or credentials are available.",
    "",
    "The password is requested without echo and saved with restricted file permissions.",
  ].join("\n"),
  async run(args) {
    await loadAppConfig();
    const username = option(args, "--username") ?? process.env.INSPIRE_USERNAME ?? await ask("Username");
    const password = process.env.INSPIRE_PASSWORD ?? await askHidden("Password");
    const baseUrl = option(args, "--base-url") ?? process.env.INSPIRE_BASE_URL ?? DEFAULT_BASE_URL;
    const session = await loginHttp({ username, password, baseUrl });
    await saveSession(session);
    await saveCredentials({ username, password, base_url: baseUrl });
    console.log("Login successful.");
  },
};

export const logoutCommand: Command = {
  name: "logout",
  short: "clear the current session",
  description: "Clear the session. Use --forget to also remove saved credentials.",
  usage: "siimit logout [--forget]",
  flagOptions: ["--forget"],
  details: [
    "Options:",
    "  --forget     Also remove the saved username and password",
    "  -h, --help   Show this help",
    "",
    "Without --forget, the next authenticated command can log in again automatically.",
  ].join("\n"),
  async run(args) {
    await removeSession();
    if (args.includes("--forget")) await removeCredentials();
    console.log(args.includes("--forget") ? "Logged out and forgot saved credentials." : "Logged out.");
  },
};
