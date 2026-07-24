import type { InspireClient } from "../platform/client";
import { renderTable } from "../shared/table";
import {
  availableTaskPriorities,
  listProjectPage,
} from "../platform/catalog/projects";

export interface ProjectRow {
  id: string;
  name: string;
  availablePriorities: Array<"low" | "high">;
  budget: number | null;
  remaining: number | null;
  memberRemaining: number | null;
}

export async function listParticipatingProjects(client: InspireClient): Promise<ProjectRow[]> {
  const rows: ProjectRow[] = [];
  let page = 1;
  while (true) {
    const result = await listProjectPage(client, { page });
    const items = result.items;
    for (const item of items) {
      rows.push({
        id: item.id,
        name: item.name,
        availablePriorities: availableTaskPriorities(item.priorityLimit),
        budget: item.budget,
        remaining: item.remaining,
        memberRemaining: item.memberRemaining,
      });
    }
    if (!items.length || rows.length >= result.total || items.length < 100) break;
    page += 1;
  }
  return rows.sort((left, right) => left.name.localeCompare(right.name, "zh-CN"));
}

export function renderProjects(rows: ProjectRow[], wide = false): string {
  if (!rows.length) return "No participating projects found.";
  return renderTable(
    ["PROJECT", "PRIORITIES", "BUDGET", "REMAINING", "MY REMAINING", "ID"],
    rows.map((row) => [
      row.name,
      row.availablePriorities.join(","),
      formatNumber(row.budget),
      formatNumber(row.remaining),
      formatNumber(row.memberRemaining),
      row.id,
    ]),
    {
      maxWidths: [36, 10, 14, 14, 14, 32],
      align: ["left", "right", "right", "right", "right", "left"],
      wide,
    },
  );
}

function formatNumber(value: number | null): string {
  if (value === null) return "-";
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 }).format(value);
}
