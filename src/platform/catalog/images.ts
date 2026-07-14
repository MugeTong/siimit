import type { AppConfig } from "../../config";
import { ConfigurationError } from "../../errors";
import { asRecord, records } from "../../shared/records";
import type { InspireClient } from "../client";

export interface PrivateImage {
  name: string;
  version: string;
  address: string;
  status: string;
  source: "SOURCE_PRIVATE";
}

export async function listPrivateImages(
  client: InspireClient,
  workspaceId: string,
  config: AppConfig,
): Promise<PrivateImage[]> {
  const response = await client.postJson("/api/v1/image/list", {
    page: 0,
    page_size: -1,
    filter: {
      source_list: config.image_sources,
      visibility: config.image_visibility,
      registry_hint: { workspace_id: workspaceId },
    },
  });
  return records(asRecord(response.data)?.images)
    .flatMap((item): PrivateImage[] => {
      const address = String(item.address ?? "").trim();
      if (!address) return [];
      const version = String(item.version ?? "").trim();
      const rawName = String(item.name ?? "").trim();
      const name = version && rawName.endsWith(`:${version}`)
        ? rawName.slice(0, -(version.length + 1))
        : rawName;
      return [{
        name,
        version,
        address,
        status: String(item.status ?? ""),
        source: "SOURCE_PRIVATE",
      }];
    })
    .sort((left, right) => `${left.name}:${left.version}`.localeCompare(`${right.name}:${right.version}`));
}

export async function resolvePrivateImage(
  client: InspireClient,
  workspaceId: string,
  requested: string,
  config: AppConfig,
): Promise<{ address: string; source: "SOURCE_PRIVATE" }> {
  const target = requested.trim().toLowerCase();
  const images = await listPrivateImages(client, workspaceId, config);
  const matches = images.filter((image) =>
    [image.name, image.address, image.name && image.version ? `${image.name}:${image.version}` : ""]
      .filter(Boolean)
      .some((label) => label.toLowerCase() === target)
  );
  const unique = [...new Map(matches.map((image) => [image.address, image])).values()];
  if (unique.length === 1) return { address: unique[0]!.address, source: "SOURCE_PRIVATE" };
  if (unique.length > 1) {
    throw new ConfigurationError(
      `Image ${JSON.stringify(requested)} matches multiple visible images: ${unique.map((item) => item.address).join(", ")}. Pass the full image address.`,
    );
  }
  const suggestions = images
    .flatMap((image) => [image.name, image.address, image.name && image.version ? `${image.name}:${image.version}` : ""])
    .filter((label) => label && (label.toLowerCase().includes(target) || target.includes(label.toLowerCase())))
    .slice(0, 5);
  throw new ConfigurationError(
    `Image ${JSON.stringify(requested)} was not found in the private image catalogue.`
    + (suggestions.length ? ` Similar visible images: ${[...new Set(suggestions)].join(", ")}.` : ""),
  );
}
