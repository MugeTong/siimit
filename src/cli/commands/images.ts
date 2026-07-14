import { loadAppConfig } from "../../config";
import { listVisibleImages, renderImages } from "../../images";
import { withReadClient } from "../runtime";

export async function runImages(args: string[]): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) {
    console.log("Usage: siimit images [--json]\n\nList personal private images visible in the configured training workspace.");
    return;
  }
  const config = await loadAppConfig();
  const images = await withReadClient((client) => listVisibleImages(client, config));
  if (args.includes("--json")) console.log(JSON.stringify(images, null, 2));
  else console.log(renderImages(images));
}
