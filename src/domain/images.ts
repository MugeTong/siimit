import type { AppConfig } from "../config";
import { listPrivateImages, type PrivateImage } from "../platform/catalog/images";
import { resolveWorkspace } from "../platform/catalog/workspaces";
import type { InspireClient } from "../platform/client";
import { renderTable } from "../shared/table";

export interface ImageRow {
  image: string;
  status: string;
  address: string;
}

export async function listVisibleImages(
  client: InspireClient,
  config: AppConfig,
): Promise<ImageRow[]> {
  const workspaceId = await resolveWorkspace(client, config.workspace);
  return (await listPrivateImages(client, workspaceId)).map(imageRow);
}

export function renderImages(images: ImageRow[], wide = false): string {
  if (!images.length) return "No private images found.";
  return renderTable(
    ["IMAGE", "STATUS", "ADDRESS"],
    images.map((image) => [image.image, image.status, image.address]),
    { maxWidths: [48, 12, 80], wide },
  );
}

function imageRow(image: PrivateImage): ImageRow {
  return {
    image: image.version ? `${image.name}:${image.version}` : image.name,
    status: image.status,
    address: image.address,
  };
}
