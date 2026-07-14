import { getDistributedTrainingCapacity, renderCapacity } from "../../capacity";
import { loadAppConfig } from "../../config";
import { option } from "../args";
import { printGroupsHelp } from "../help";
import { withReadClient } from "../runtime";

export async function runGroups(args: string[]): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) return printGroupsHelp();
  const config = await loadAppConfig();
  const project = option(args, "--project") ?? option(args, "-p");
  const rows = await withReadClient((client) =>
    getDistributedTrainingCapacity(client, config.workspace, project)
  );
  if (args.includes("--json")) {
    console.log(JSON.stringify(rows, null, 2));
    return;
  }
  console.log(renderCapacity(rows, config.workspace, args.includes("--wide")));
  if (!project) console.log("\nTip: use --project PROJECT to show GPU sizes you are allowed to request.");
}
