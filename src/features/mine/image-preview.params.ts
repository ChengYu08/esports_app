export type ImagePreviewParams = {
  images: string;
  index: string;
};

export function createImagePreviewParams(images: string[], index: number): ImagePreviewParams {
  return {
    images: JSON.stringify(images),
    index: String(Math.max(0, Math.min(index, Math.max(images.length - 1, 0)))),
  };
}

export function parseImagePreviewParams(params: { images?: string | string[]; index?: string | string[] }) {
  const rawImages = Array.isArray(params.images) ? params.images[0] : params.images;
  const rawIndex = Array.isArray(params.index) ? params.index[0] : params.index;

  try {
    const images = JSON.parse(rawImages ?? "");
    if (!Array.isArray(images) || !images.every((image) => typeof image === "string")) {
      return { images: [], index: 0 };
    }

    const requestedIndex = Number(rawIndex);
    const index = Number.isInteger(requestedIndex) ? requestedIndex : 0;
    return { images, index: Math.max(0, Math.min(index, Math.max(images.length - 1, 0))) };
  } catch {
    return { images: [], index: 0 };
  }
}
