import type { AppConfig } from "../config";
import type { InspireClient } from "../platform/client";
import { wrapShellCommand } from "../shared/shell";
import { resolvePrivateImage } from "../platform/catalog/images";
import { resolveProject, taskPriorityValue, type TaskPriorityLevel } from "../platform/catalog/projects";
import { resolveQuota } from "../platform/catalog/quotas";
import { resolveWorkspace } from "../platform/catalog/workspaces";

export interface SubmitOptions {
  name: string;
  command: string;
  project: string;
  group: string;
  gpus: number;
  nodes?: number;
  image: string;
  maxTimeHours: number;
  priority?: TaskPriorityLevel;
  shmSizeGiB?: number;
  excludeNodes: string[];
}

export async function buildSubmissionPayload(
  client: InspireClient,
  options: SubmitOptions,
  config: AppConfig,
): Promise<Record<string, unknown>> {
  const workspaceId = await resolveWorkspace(client, config.workspace);
  const project = await resolveProject(client, workspaceId, options.project);
  const taskPriority = taskPriorityValue(project, options.priority);
  const quota = await resolveQuota(
    client,
    workspaceId,
    options.group,
    options.gpus,
    project.id,
    taskPriority,
  );
  const image = await resolvePrivateImage(client, workspaceId, options.image);
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
    command: wrapShellCommand(options.command),
    framework: config.framework,
    project_id: project.id,
    workspace_id: workspaceId,
    logic_compute_group_id: quota.groupId,
    task_priority: taskPriority,
    framework_config: [frameworkConfig],
  };
  payload.max_running_time_ms = String(Math.trunc(options.maxTimeHours * 3_600_000));
  if (options.excludeNodes.length) payload.exclude_nodes = options.excludeNodes;
  return payload;
}
