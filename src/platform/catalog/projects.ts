import { ApiError, ConfigurationError } from "../../errors";
import { asRecord, records } from "../../shared/records";
import type { InspireClient } from "../client";

export interface ResolvedProject {
  id: string;
  maxPriority: number;
}

export async function resolveProject(
  client: InspireClient,
  workspaceId: string,
  requested: string,
): Promise<ResolvedProject> {
  const response = await client.postJson(
    "/api/v1/project/list",
    { page: 1, page_size: 100, filter: { workspace_id: workspaceId, check_admin: true } },
    "/jobs/interactiveModeling",
  );
  const project = records(asRecord(response.data)?.items)
    .find((item) => item.name === requested || item.id === requested);
  if (!project) throw new ConfigurationError(`No project exactly matches ${JSON.stringify(requested)}.`);
  const id = String(project.id ?? "");
  if (!id) throw new ApiError("Matched project has no id.");
  const maxPriority = Number(project.priority_name ?? 10);
  return { id, maxPriority: Number.isInteger(maxPriority) ? maxPriority : 10 };
}
