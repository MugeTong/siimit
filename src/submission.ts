import type { AppConfig } from "./config";
import { ApiError, ConfigurationError } from "./errors";
import type { InspireClient } from "./client";

export interface SubmitOptions {
  name: string;
  command: string;
  project: string;
  group: string;
  gpus: number;
  nodes?: number;
  image: string;
  maxTimeHours?: number;
  shmSizeGiB?: number;
  logFile?: string;
  appendLog?: boolean;
  excludeNodes: string[];
}

interface QuotaSpec {
  gpu: number;
  cpu: number;
  memoryGiB: number;
}

interface ResolvedQuota extends QuotaSpec {
  quotaId: string;
  groupId: string;
  gpuType?: string;
  cpuType: string;
}

interface ResolvedImage {
  address: string;
  source: string;
}

export async function buildSubmissionPayload(
  client: InspireClient,
  options: SubmitOptions,
  config: AppConfig,
): Promise<Record<string, unknown>> {
  const workspaceId = await resolveWorkspace(client, config.workspace);
  const project = await resolveProject(client, workspaceId, options.project);
  const quota = await resolveQuota(
    client,
    workspaceId,
    options.group,
    options.gpus,
    project.id,
    project.maxPriority,
  );
  const image = await resolveImage(client, workspaceId, options.image, config);
  const resourceSpec: Record<string, unknown> = {
    cpu_type: quota.cpuType,
    cpu_count: quota.cpu,
    gpu_count: quota.gpu,
    memory_size_gib: quota.memoryGiB,
    logic_compute_group_id: quota.groupId,
    quota_id: quota.quotaId,
  };
  if (quota.gpu > 0) resourceSpec.gpu_type = quota.gpuType ?? "";

  const frameworkConfig: Record<string, unknown> = {
    image_type: image.source,
    image: image.address,
    instance_count: options.nodes ?? config.nodes,
    cpu: quota.cpu,
    gpu_count: quota.gpu,
    mem_gi: quota.memoryGiB,
    resource_spec_price: resourceSpec,
  };
  if (options.shmSizeGiB !== undefined) frameworkConfig.shm_gi = options.shmSizeGiB;

  const payload: Record<string, unknown> = {
    name: options.name,
    command: wrapCommand(options.command, options.logFile, options.appendLog === true),
    framework: config.framework,
    project_id: project.id,
    workspace_id: workspaceId,
    logic_compute_group_id: quota.groupId,
    task_priority: project.maxPriority,
    framework_config: [frameworkConfig],
  };
  if (options.maxTimeHours !== undefined) {
    payload.max_running_time_ms = String(Math.trunc(options.maxTimeHours * 3_600_000));
  }
  if (options.excludeNodes.length) payload.exclude_nodes = options.excludeNodes;
  return payload;
}

async function resolveImage(
  client: InspireClient,
  workspaceId: string,
  requested: string,
  config: AppConfig,
): Promise<ResolvedImage> {
  const target = requested.trim().toLowerCase();
  const matches: ResolvedImage[] = [];
  const visibleLabels: string[] = [];
  const response = await client.postJson("/api/v1/image/list", {
    page: 0,
    page_size: -1,
    filter: {
      source_list: config.image_sources,
      visibility: config.image_visibility,
      registry_hint: { workspace_id: workspaceId },
    },
  });
  for (const item of arrayOfRecords(record(response.data)?.images)) {
    const name = String(item.name ?? "").trim();
    const version = String(item.version ?? "").trim();
    const address = String(item.address ?? "").trim();
    const labels = [name, address, name && version ? `${name}:${version}` : ""].filter(Boolean);
    visibleLabels.push(...labels);
    if (!labels.some((label) => label.toLowerCase() === target) || !address) continue;
    matches.push({
      address,
      // The private catalogue endpoint can return stale/mislabelled source metadata.
      // Submission semantics are determined by the catalogue we deliberately queried.
      source: "SOURCE_PRIVATE",
    });
  }
  const unique = [...new Map(matches.map((match) => [
    `${match.source}\0${match.address}`,
    match,
  ])).values()];
  if (unique.length === 1) return unique[0]!;
  if (unique.length > 1) {
    throw new ConfigurationError(
      `Image ${JSON.stringify(requested)} matches multiple visible images: ${unique.map((item) => item.address).join(", ")}. Pass the full image address.`,
    );
  }
  const suggestions = [...new Set(visibleLabels)]
    .filter((label) => label.toLowerCase().includes(target) || target.includes(label.toLowerCase()))
    .slice(0, 5);
  throw new ConfigurationError(
    `Image ${JSON.stringify(requested)} was not found in the private image catalogue.`
    + (suggestions.length ? ` Similar visible images: ${suggestions.join(", ")}.` : ""),
  );
}

export function parseQuota(value: string): QuotaSpec {
  const parts = value.split(",").map((item) => Number(item.trim()));
  if (parts.length !== 3 || parts.some((item) => !Number.isInteger(item))) {
    throw new ConfigurationError("--quota must be 'gpu,cpu,memory_gib', for example 4,80,800.");
  }
  const [gpu, cpu, memoryGiB] = parts as [number, number, number];
  if (gpu < 0 || cpu < 1 || memoryGiB < 1) {
    throw new ConfigurationError("--quota requires gpu>=0, cpu>=1 and memory_gib>=1.");
  }
  return { gpu, cpu, memoryGiB };
}

export async function listWorkspaces(
  client: InspireClient,
): Promise<Array<{ id: string; name: string }>> {
  const response = await client.getJson("/api/v1/user/routes/default");
  const routes = record(response.data)?.routes;
  const workspaces: Array<{ id: string; name: string }> = [];
  for (const group of arrayOfRecords(routes)) {
    if (group.name !== "userWorkspaceList") continue;
    for (const item of arrayOfRecords(group.routes)) {
      const id = String(item.path ?? "");
      if (id) workspaces.push({ id, name: String(item.name ?? id) });
    }
  }
  return workspaces;
}

export async function resolveWorkspace(client: InspireClient, requested: string): Promise<string> {
  if (requested.startsWith("ws-")) return requested;
  const workspace = (await listWorkspaces(client)).find(
    (item) => item.name === requested || item.id === requested,
  );
  if (!workspace) throw new ConfigurationError(`No workspace exactly matches ${JSON.stringify(requested)}.`);
  return workspace.id;
}

export async function resolveProject(
  client: InspireClient,
  workspaceId: string,
  requested: string,
): Promise<{ id: string; maxPriority: number }> {
  const response = await client.postJson(
    "/api/v1/project/list",
    { page: 1, page_size: 100, filter: { workspace_id: workspaceId, check_admin: true } },
    "/jobs/interactiveModeling",
  );
  const items = arrayOfRecords(record(response.data)?.items);
  const project = items.find((item) => item.name === requested || item.id === requested);
  if (!project) throw new ConfigurationError(`No project exactly matches ${JSON.stringify(requested)}.`);
  const id = String(project.id ?? "");
  if (!id) throw new ApiError("Matched project has no id.");
  const maxPriority = Number(project.priority_name ?? 10);
  return { id, maxPriority: Number.isInteger(maxPriority) ? maxPriority : 10 };
}

async function resolveQuota(
  client: InspireClient,
  workspaceId: string,
  requestedGroup: string,
  gpuCount: number,
  projectId: string,
  taskPriority: number,
): Promise<ResolvedQuota> {
  const groupResponse = await client.postJson("/api/v1/logic_compute_groups/list", {
    page_size: -1,
    page_num: 1,
    filter: { workspace_id: workspaceId },
  });
  const groups = arrayOfRecords(record(groupResponse.data)?.logic_compute_groups);
  const group = groups.find((item) => groupName(item) === requestedGroup || groupId(item) === requestedGroup);
  if (!group) throw new ConfigurationError(`No compute group exactly matches ${JSON.stringify(requestedGroup)}.`);
  const selectedGroupId = groupId(group);
  const priceResponse = await client.postJson("/api/v1/resource_prices/logic_compute_groups", {
    workspace_id: workspaceId,
    schedule_config_type: "SCHEDULE_CONFIG_TYPE_TRAIN",
    logic_compute_group_id: selectedGroupId,
    project_id: projectId,
    task_priority: taskPriority,
  });
  const data = priceResponse.data;
  const rows = Array.isArray(data)
    ? arrayOfRecords(data)
    : arrayOfRecords(record(data)?.lcg_resource_spec_prices ?? record(data)?.resource_spec_prices ?? record(data)?.list);
  const candidates = rows
    .filter((item) => number(item.gpu_count) === gpuCount)
    .sort((left, right) =>
      number(right.cpu_count) - number(left.cpu_count)
      || memory(right) - memory(left)
    );
  const price = candidates[0];
  if (!price) throw new ConfigurationError(`No ${gpuCount}-GPU quota exists in compute group ${requestedGroup}.`);
  const quotaId = String(price.quota_id ?? price.spec_id ?? "");
  if (!quotaId) throw new ApiError("Matched quota has no quota_id.");
  const gpuInfo = record(price.gpu_info);
  const cpuInfo = record(price.cpu_info);
  const gpuType = String(gpuInfo?.gpu_type ?? price.gpu_type ?? "");
  return {
    gpu: gpuCount,
    cpu: number(price.cpu_count),
    memoryGiB: memory(price),
    quotaId,
    groupId: selectedGroupId,
    ...(gpuType ? { gpuType } : {}),
    cpuType: String(cpuInfo?.cpu_type ?? ""),
  };
}

function exactId(
  items: Record<string, unknown>[],
  requested: string,
  kind: string,
  idKey: string,
): string {
  const item = items.find((candidate) => candidate.name === requested || candidate[idKey] === requested);
  if (!item) throw new ConfigurationError(`No ${kind} exactly matches ${JSON.stringify(requested)}.`);
  const id = String(item[idKey] ?? "");
  if (!id) throw new ApiError(`Matched ${kind} has no ${idKey}.`);
  return id;
}

function groupId(item: Record<string, unknown>): string {
  return String(item.logic_compute_group_id ?? item.id ?? "");
}

function groupName(item: Record<string, unknown>): string {
  return String(item.name ?? item.logic_compute_group_name ?? "");
}

function memory(item: Record<string, unknown>): number {
  return number(item.memory_size_gib ?? item.memory_size ?? item.memory_size_gb);
}

function number(value: unknown): number {
  return Number(value ?? 0);
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function arrayOfRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => record(item) !== undefined) : [];
}

export function expandLogFileTemplate(template: string, name: string, now = new Date()): string {
  const timestamp = now.toISOString().replaceAll(":", "-");
  return template.replaceAll("{name}", name).replaceAll("{timestamp}", timestamp);
}

function wrapCommand(command: string, logFile?: string, append = false): string {
  if (logFile) {
    const quotedPath = shellQuote(logFile);
    const redirect = append ? ">>" : ">";
    const script = `LOG_FILE=${quotedPath}; mkdir -p -- "$(dirname -- "$LOG_FILE")" && ( ${command} ) ${redirect} "$LOG_FILE" 2>&1`;
    return `bash -c ${shellQuote(script)}`;
  }
  const trimmed = command.trim();
  if (/^(bash|sh|\/bin\/bash|\/bin\/sh) -c /.test(trimmed)) return command;
  return `bash -c ${shellQuote(command)}`;
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}
