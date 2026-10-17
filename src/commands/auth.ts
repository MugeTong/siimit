import { rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { DEFAULT_BASE_URL, loadAppConfig, removeCredentials, removeSession } from "../config";
import { ConfigurationError } from "../errors";
import type { Command } from "./command";
import { option } from "./args";

export const loginCommand: Command = {
  name: "login",
  short: "authenticate with the platform",
  description: "Log in through the official qz device authorization flow.",
  usage: "siimit login [--base-url URL]",
  valueOptions: ["--base-url"],
  details: [
    "Options:",
    "  --base-url URL    Platform URL; normally does not need to be changed",
    "  -h, --help        Show this help without starting login",
    "",
    "Authentication is handled by the official qz client using a browser device login.",
    "Siimit no longer stores your username or password.",
  ].join("\n"),
  async run(args) {
    await loadAppConfig();
    const baseUrl = option(args, "--base-url") ?? process.env.INSPIRE_BASE_URL ?? DEFAULT_BASE_URL;
    let qzProcess: Bun.Subprocess;
    try {
      qzProcess = Bun.spawn(["qz", "login", "--server", baseUrl], {
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
      });
    } catch (error) {
      throw new ConfigurationError(
        `The official qz client is required: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    if (await qzProcess.exited !== 0) throw new ConfigurationError("Login did not complete.");
  },
};

export const logoutCommand: Command = {
  name: "logout",
  short: "clear the current session",
  description: "Clear the local qz login token and legacy Siimit credentials.",
  usage: "siimit logout [--forget]",
  flagOptions: ["--forget"],
  details: [
    "Options:",
    "  --forget     Also remove the local qz encryption key",
    "  -h, --help   Show this help",
    "",
    "The next authenticated command will ask you to run siimit login again.",
  ].join("\n"),
  async run(args) {
    await removeSession();
    await removeCredentials();
    const qzDir = process.env.QZ_CLI_CONFIG_DIR ?? join(homedir(), ".config", "inspire-cli");
    await rm(join(qzDir, "credentials.enc"), { force: true });
    if (args.includes("--forget")) await rm(join(qzDir, ".encryption_key"), { force: true });
    console.log(args.includes("--forget") ? "Logged out and removed the local qz key." : "Logged out.");
  },
};
