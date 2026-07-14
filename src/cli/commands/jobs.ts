import { listCurrentUserJobs, renderJobs } from "../../domain/jobs";
import { numericOption, option } from "../args";
import { printListHelp } from "../help";
import { withReadClient } from "../runtime";

export async function runList(args: string[]): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) return printListHelp();
  const options = {
    ...(option(args, "--workspace") ? { workspace: option(args, "--workspace")! } : {}),
    ...(option(args, "--status") ? { status: option(args, "--status")! } : {}),
    ...(option(args, "--keyword") ? { keyword: option(args, "--keyword")! } : {}),
    limit: numericOption(args, "--limit", 20),
  };
  const rows = await withReadClient((client) => listCurrentUserJobs(client, options));
  console.log(args.includes("--json") ? JSON.stringify(rows, null, 2) : renderJobs(rows, args.includes("--wide")));
}
