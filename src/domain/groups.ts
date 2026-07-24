import type { InspireClient } from "../platform/client";
import { ConfigurationError } from "../errors";
import { resolveProject, taskPriorityValue } from "../platform/catalog/projects";
import {
  getGroupCapacity,
  listComputeGroups,
  listGroupPrices,
} from "../platform/catalog/groups";
import { resolveWorkspace } from "../platform/catalog/workspaces";
import { renderTable } from "../shared/table";

export interface GroupRow {
  id: string;
  group: string;
  gpuType: string;
  gpuSizes: number[] | null;
  free: number;
  overcommitted: number;
  lowPriorityUsed: number;
  used: number;
  total: number;
}

export async function listGroups(
  client: InspireClient,
  workspace: string,
  projectName?: string,
): Promise<GroupRow[]> {
  const workspaceId = await resolveWorkspace(client, workspace);
  const project = projectName
    ? await resolveProject(client, workspaceId, projectName)
    : undefined;
  const groups = await listComputeGroups(client, workspaceId);
  if (!groups.length) {
    throw new ConfigurationError(
      `No compute groups were found in ${workspace}.`,
    );
  }

  const rows: GroupRow[] = [];
  let priceRequestCount = 0;
  for (const group of groups) {
    const capacity = await getGroupCapacity(client, group.id);
    const total = capacity.total;
    if (total <= 0) continue;
    const used = capacity.used;
    const lowPriority = capacity.lowPriorityUsed;
    const free = Math.max(0, total - used);
    const overcommitted = Math.max(0, used - total);
    let gpuSizes: number[] | null = null;
    if (project) {
      // This pricing endpoint is rate-limited more aggressively than group availability.
      if (priceRequestCount > 0) await delay(750);
      priceRequestCount += 1;
      const priceRows = await listGroupPrices(client, {
        workspaceId,
        groupId: group.id,
        projectId: project.id,
        taskPriority: taskPriorityValue(project),
      });
      gpuSizes = [...new Set(priceRows.map((item) => integer(item.gpu_count)).filter((count) => count > 0))]
        .sort((left, right) => left - right);
    }
    rows.push({
      id: group.id,
      group: group.name,
      gpuType: capacity.gpuType,
      gpuSizes,
      free,
      overcommitted,
      lowPriorityUsed: lowPriority,
      used,
      total,
    });
  }
  return rows.sort(
    (left, right) =>
      right.free - left.free ||
      right.total - left.total,
  );
}

export function renderGroups(rows: GroupRow[], workspace: string, wide = false): string {
  if (!rows.length) return `No GPU capacity found in ${workspace}.`;
  const header = ["GPU TYPE", "COMPUTE GROUP", "GPU SIZES", "FREE", "OVERCOMMITTED", "LOW PRI USED", "USED", "TOTAL", "ID"];
  const values = rows.map((row) => [
    row.gpuType,
    row.group,
    row.gpuSizes?.join(",") ?? "-",
    String(row.free),
    String(row.overcommitted),
    String(row.lowPriorityUsed),
    String(row.used),
    String(row.total),
    row.id,
  ]);
  const totals = rows.reduce(
    (sum, row) => ({
      free: sum.free + row.free,
      overcommitted: sum.overcommitted + row.overcommitted,
      lowPriorityUsed: sum.lowPriorityUsed + row.lowPriorityUsed,
      used: sum.used + row.used,
      total: sum.total + row.total,
    }),
    { free: 0, overcommitted: 0, lowPriorityUsed: 0, used: 0, total: 0 },
  );
  values.push([
    "TOTAL",
    "",
    "",
    String(totals.free),
    String(totals.overcommitted),
    String(totals.lowPriorityUsed),
    String(totals.used),
    String(totals.total),
    "",
  ]);
  return [
    `Workspace: ${workspace}`,
    renderTable(header, values, {
      maxWidths: [22, 32, 11, 6, 13, 12, 8, 7, 32],
      align: ["left", "left", "right", "right", "right", "right", "right", "right", "left"],
      wide,
    }),
  ].join("\n");
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function integer(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}
