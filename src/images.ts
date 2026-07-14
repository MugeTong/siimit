import type { AppConfig } from "./config";
import { listPrivateImages, type PrivateImage } from "./platform/catalog/images";
import { resolveWorkspace } from "./platform/catalog/workspaces";
import type { InspireClient } from "./platform/client";
import { renderTable } from "./table";

export async function listVisibleImages(
  client: InspireClient,
  config: AppConfig,
): Promise<PrivateImage[]> {
  const workspaceId = await resolveWorkspace(client, config.workspace);
  return listPrivateImages(client, workspaceId, config);
}

export function renderImages(images: PrivateImage[], wide = false): string {
  if (!images.length) return "No private images found.";
  return renderTable(
    ["NAME", "VERSION", "STATUS", "ADDRESS"],
    images.map((image) => [image.name, image.version, image.status, image.address]),
    { maxWidths: [28, 18, 12, 80], wide },
  );
}
