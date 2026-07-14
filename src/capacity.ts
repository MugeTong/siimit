import type { InspireClient } from "./platform/client";
import { ConfigurationError } from "./errors";
import { resolveProject } from "./platform/catalog/projects";
import { resolveWorkspace } from "./platform/catalog/workspaces";
import { renderTable } from "./table";
import { asRecord as record, records as arrayOfRecords } from "./shared/records";

export interface CapacityRow {
  group: string;
  gpuType: string;
  gpuSizes: number[] | null;
  free: number;
  overcommitted: number;
  highPriority: number;
  used: number;
  preemptible: number;
  total: number;
}

export async function getDistributedTrainingCapacity(
  client: InspireClient,
  workspace: string,
  projectName?: string,
): Promise<CapacityRow[]> {
  const workspaceId = await resolveWorkspace(client, workspace);
  const project = projectName
    ? await resolveProject(client, workspaceId, projectName)
    : undefined;
  const groupResponse = await client.postJson("/api/v1/logic_compute_groups/list", {
    page_size: -1,
    page_num: 1,
    filter: { workspace_id: workspaceId },
  });
  const groups = arrayOfRecords(record(groupResponse.data)?.logic_compute_groups);
  if (!groups.length) {
    throw new ConfigurationError(
      `No compute groups were found in ${workspace}.`,
    );
  }

  const rows: CapacityRow[] = [];
  let priceRequestCount = 0;
  for (const group of groups) {
    const groupId = String(group.logic_compute_group_id ?? group.id ?? "");
    if (!groupId) continue;
    const response = await client.getJson(
      `/api/v1/compute_resources/logic_compute_groups/${encodeURIComponent(groupId)}`,
    );
    const data = record(response.data) ?? {};
    const resources = record(data.logic_resouces) ?? {};
    const total = integer(resources.gpu_total);
    if (total <= 0) continue;
    const used = integer(resources.gpu_used);
    const lowPriority = integer(resources.gpu_low_priority_used);
    const free = Math.max(0, total - used);
    const overcommitted = Math.max(0, used - total);
    const gpuStats = arrayOfRecords(data.gpu_type_stats);
    const gpuInfo = record(gpuStats[0]?.gpu_info);
    let gpuSizes: number[] | null = null;
    if (project) {
      // This pricing endpoint is rate-limited more aggressively than capacity.
      if (priceRequestCount > 0) await delay(750);
      priceRequestCount += 1;
      const prices = await client.postJson("/api/v1/resource_prices/logic_compute_groups", {
        workspace_id: workspaceId,
        schedule_config_type: "SCHEDULE_CONFIG_TYPE_TRAIN",
        logic_compute_group_id: groupId,
        project_id: project.id,
        task_priority: project.maxPriority,
      });
      const priceData = prices.data;
      const priceRows = Array.isArray(priceData)
        ? arrayOfRecords(priceData)
        : arrayOfRecords(record(priceData)?.lcg_resource_spec_prices ?? record(priceData)?.resource_spec_prices ?? record(priceData)?.list);
      gpuSizes = [...new Set(priceRows.map((item) => integer(item.gpu_count)).filter((count) => count > 0))]
        .sort((left, right) => left - right);
    }
    rows.push({
      group: String(group.name ?? group.logic_compute_group_name ?? groupId),
      gpuType: String(gpuInfo?.gpu_type_display ?? gpuInfo?.gpu_product_simple ?? "GPU"),
      gpuSizes,
      free,
      overcommitted,
      highPriority: Math.max(0, total - used + lowPriority),
      used,
      preemptible: lowPriority,
      total,
    });
  }
  return rows.sort((left, right) => right.highPriority - left.highPriority);
}

export function renderCapacity(rows: CapacityRow[], workspace: string, wide = false): string {
  if (!rows.length) return `No GPU capacity found in ${workspace}.`;
  const header = ["GPU TYPE", "COMPUTE GROUP", "GPU SIZES", "FREE", "OVERCOMMITTED", "PREEMPTIBLE", "HIGH PRI", "USED", "TOTAL"];
  const values = rows.map((row) => [
    row.gpuType,
    row.group,
    row.gpuSizes?.join(",") ?? "-",
    String(row.free),
    String(row.overcommitted),
    String(row.preemptible),
    String(row.highPriority),
    String(row.used),
    String(row.total),
  ]);
  const totals = rows.reduce(
    (sum, row) => ({
      free: sum.free + row.free,
      overcommitted: sum.overcommitted + row.overcommitted,
      preemptible: sum.preemptible + row.preemptible,
      highPriority: sum.highPriority + row.highPriority,
      used: sum.used + row.used,
      total: sum.total + row.total,
    }),
    { free: 0, overcommitted: 0, preemptible: 0, highPriority: 0, used: 0, total: 0 },
  );
  values.push([
    "TOTAL",
    "",
    "",
    String(totals.free),
    String(totals.overcommitted),
    String(totals.preemptible),
    String(totals.highPriority),
    String(totals.used),
    String(totals.total),
  ]);
  return [
    `Workspace: ${workspace}`,
    renderTable(header, values, {
      maxWidths: [22, 32, 11, 6, 13, 11, 8, 8, 7],
      align: ["left", "left", "right", "right", "right", "right", "right", "right", "right"],
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
