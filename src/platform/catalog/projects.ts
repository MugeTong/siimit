import { ApiError, ConfigurationError } from "../../errors";
import { asRecord, records } from "../../shared/records";
import type { InspireClient } from "../client";

export interface ResolvedProject {
  id: string;
  priorityLimit: number;
}

export type TaskPriorityLevel = "low" | "high";

export function availableTaskPriorities(priorityLimit: number): TaskPriorityLevel[] {
  return priorityLimit >= 4 ? ["low", "high"] : ["low"];
}

export function taskPriorityValue(
  project: ResolvedProject,
  requested?: TaskPriorityLevel,
): 1 | 4 {
  const available = availableTaskPriorities(project.priorityLimit);
  const selected = requested ?? available.at(-1)!;
  if (!available.includes(selected)) {
    throw new ConfigurationError(
      `Priority ${selected} is not available for this project. Available priorities: ${available.join(", ")}.`,
    );
  }
  return selected === "high" ? 4 : 1;
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
  const namedPriority = Number(project.priority_name);
  const priorityLimit = Number.isFinite(namedPriority)
    ? namedPriority
    : String(project.priority_level ?? "").toUpperCase() === "HIGH" ? 4 : 1;
  return { id, priorityLimit };
}
