import { ApiError, ConfigurationError } from "../../errors";
import { asRecord, records } from "../../shared/records";
import type { InspireClient } from "../client";

export interface ResolvedProject {
  id: string;
  priorityLimit: number;
}

export interface PlatformProject extends ResolvedProject {
  name: string;
  budget: number | null;
  remaining: number | null;
  memberRemaining: number | null;
}

export interface ProjectPage {
  items: PlatformProject[];
  total: number;
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
  const page = await listProjectPage(client, {
    page: 1,
    workspaceId,
    referer: "/jobs/interactiveModeling",
  });
  const project = page.items
    .find((item) => item.name === requested || item.id === requested);
  if (!project) throw new ConfigurationError(`No project exactly matches ${JSON.stringify(requested)}.`);
  return { id: project.id, priorityLimit: project.priorityLimit };
}

export async function listProjectPage(
  client: InspireClient,
  options: {
    page: number;
    workspaceId?: string;
    referer?: string;
  },
): Promise<ProjectPage> {
  const response = await client.postJson(
    "/api/v1/project/list",
    {
      page: options.page,
      page_size: 100,
      filter: {
        ...(options.workspaceId ? { workspace_id: options.workspaceId } : {}),
        check_admin: true,
      },
    },
    options.referer ?? "/projects",
  );
  if (response.code !== undefined && Number(response.code) !== 0) {
    throw new ApiError(`Project list failed: ${String(response.message ?? response.code)}.`);
  }
  const data = asRecord(response.data) ?? {};
  const items = records(data.items).flatMap((item): PlatformProject[] => {
    const id = String(item.id ?? "");
    if (!id) return [];
    return [{
      id,
      name: String(item.name ?? ""),
      priorityLimit: projectPriorityLimit(item),
      budget: optionalNumber(item.budget),
      remaining: optionalNumber(item.remain_budget),
      memberRemaining: optionalNumber(item.member_remain_budget),
    }];
  });
  return {
    items,
    total: optionalNumber(data.total) ?? items.length,
  };
}

function projectPriorityLimit(project: Record<string, unknown>): number {
  const named = optionalNumber(project.priority_name);
  return named ?? (
    String(project.priority_level ?? "").toUpperCase() === "HIGH" ? 4 : 1
  );
}

function optionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
