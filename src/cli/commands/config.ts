import { appConfigPath, loadAppConfig } from "../../config";

export async function runConfig(args: string[]): Promise<void> {
  const action = args[0];
  if (!action || action === "--help" || action === "-h") {
    console.log("Usage:\n  siimit config path\n  siimit config show\n\nShow the application configuration path or resolved non-secret settings.");
    return;
  }
  if (action === "path") {
    console.log(appConfigPath());
    return;
  }
  if (action === "show") {
    console.log(JSON.stringify(await loadAppConfig(), null, 2));
    return;
  }
  throw new Error(`Unknown config action: ${action}`);
}
