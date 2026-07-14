import { listParticipatingProjects, renderProjects } from "../../domain/projects";
import { printProjectsHelp } from "../help";
import { withReadClient } from "../runtime";

export async function runProjects(args: string[]): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) return printProjectsHelp();
  const rows = await withReadClient(listParticipatingProjects);
  console.log(args.includes("--json") ? JSON.stringify(rows, null, 2) : renderProjects(rows, args.includes("--wide")));
}
