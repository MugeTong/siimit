import type { InspireClient } from "../platform/client";
import { ApiError } from "../errors";
import { renderTable } from "../shared/table";
import { asRecord as record, records as arrayOfRecords } from "../shared/records";
import { availableTaskPriorities } from "../platform/catalog/projects";

export interface ProjectRow {
  id: string;
  name: string;
  priorityLevel: "LOW" | "HIGH";
  availablePriorities: Array<"low" | "high">;
  budget: number | null;
  remaining: number | null;
  memberRemaining: number | null;
}

export async function listParticipatingProjects(client: InspireClient): Promise<ProjectRow[]> {
  const rows: ProjectRow[] = [];
  let page = 1;
  while (true) {
    const response = await client.postJson(
      "/api/v1/project/list",
      { page, page_size: 100, filter: { check_admin: true } },
      "/projects",
    );
    if (response.code !== undefined && Number(response.code) !== 0) {
      throw new ApiError(`Project list failed: ${String(response.message ?? response.code)}.`);
    }
    const data = record(response.data) ?? {};
    const items = arrayOfRecords(data.items);
    for (const item of items) {
      const priorityLimit = optionalNumber(item.priority_name)
        ?? (String(item.priority_level ?? "").toUpperCase() === "HIGH" ? 4 : 1);
      const availablePriorities = availableTaskPriorities(priorityLimit);
      rows.push({
        id: String(item.id ?? ""),
        name: String(item.name ?? ""),
        priorityLevel: availablePriorities.includes("high") ? "HIGH" : "LOW",
        availablePriorities,
        budget: optionalNumber(item.budget),
        remaining: optionalNumber(item.remain_budget),
        memberRemaining: optionalNumber(item.member_remain_budget),
      });
    }
    const total = optionalNumber(data.total) ?? rows.length;
    if (!items.length || rows.length >= total || items.length < 100) break;
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

function optionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}
