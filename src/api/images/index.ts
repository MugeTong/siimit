import { authStorage, discoveryStorage } from "@/storage";
import type { ServiceResponse } from "../types";

type ImageMetadata = {
  name: string;
  status: string;
};

type ImageApiMetadata = {
  image_id: string;
  name: string;
  status: string;
  address: string;
};

type ListImagesResponse = ServiceResponse<{
  images: Array<ImageApiMetadata>;
  total: number;
}>;

async function lsitImages(): Promise<Array<ImageMetadata>> {
  const token = await authStorage.load();
  const endpoint = await discoveryStorage.load("image");
  const url = new URL(endpoint, "https://qz.sii.edu.cn");
  url.searchParams.set("Action", "ListImages");
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: token,
      "x-inspire-client-source": "inspire-cli/5294f02",
    },
    body: JSON.stringify({
      page_size: 5000,
    }),
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch images: ${response.statusText}`);
  }
  const payload = (await response.json()) as ListImagesResponse;
  if (!("Result" in payload)) {
    const errorCode = payload.ResponseMetadata.Error.Code;
    const errorMessage = payload.ResponseMetadata.Error.Message;
    throw new Error(`API Error: ${errorCode} - ${errorMessage}`);
  }

  return payload.Result.images.map((image) => ({
    name: image.name,
    status: image.status,
  }));
}

export const imagesApi = {
  lsitImages,
};
