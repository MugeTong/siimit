import { asRecord, records } from "./records";

export function formatFrameworkResource(
  framework: Record<string, unknown> | undefined,
): string {
  if (!framework) return "CPU";
  const gpuCount = Number(framework.gpu_count ?? 0);
  if (!gpuCount) return "CPU";
  const price = asRecord(framework.instance_spec_price_info) ?? asRecord(framework.resource_spec_price);
  const gpuInfo = asRecord(price?.gpu_info);
  const rawType = gpuInfo?.gpu_type_display
    ?? gpuInfo?.gpu_type
    ?? gpuInfo?.gpu_product_simple
    ?? price?.gpu_type
    ?? "GPU";
  return `${gpuCount}x${normalizeGpuType(String(rawType))}`;
}

export function firstFramework(value: unknown): Record<string, unknown> | undefined {
  return records(value)[0];
}

function normalizeGpuType(value: string): string {
  if (!value.includes("_")) return value;
  const memory = /_(\d+)G$/.exec(value)?.[1];
  const product = /(?:NVIDIA_)?(H\d+)/.exec(value)?.[1];
  if (product && memory) return `NVIDIA ${product} (${memory}GB)`;
  return value.replaceAll("_", " ");
}
