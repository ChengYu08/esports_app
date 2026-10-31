import { File, FileMode } from "expo-file-system";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";

export type ImageFormat = { extension: string; mimeType: string };

function imageFormat(bytes: Uint8Array): ImageFormat | null {
  const startsWith = (...signature: number[]) => signature.every((value, index) => bytes[index] === value);
  if (startsWith(0xff, 0xd8, 0xff)) {
    return { extension: "jpg", mimeType: "image/jpeg" };
  }
  if (startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) {
    return { extension: "png", mimeType: "image/png" };
  }
  if (startsWith(0x47, 0x49, 0x46, 0x38, 0x37, 0x61) || startsWith(0x47, 0x49, 0x46, 0x38, 0x39, 0x61)) {
    return { extension: "gif", mimeType: "image/gif" };
  }
  if (startsWith(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return { extension: "webp", mimeType: "image/webp" };
  }
  return null;
}

/** 按文件魔数识别图片真实格式（后缀名不可信）；null 表示不支持的格式（HEIC/TIFF 等）或文件不可读。 */
export function detectImageFormat(uri: string): ImageFormat | null {
  const file = new File(uri);
  if (!file.exists || file.size < 12) {
    return null;
  }
  const handle = file.open(FileMode.ReadOnly);
  try {
    return imageFormat(handle.readBytes(12));
  } finally {
    handle.close();
  }
}

/** 用 image-manipulator 把图片重编码为 JPEG 缓存文件，返回新 uri。 */
export async function convertToJpeg(uri: string, quality = 0.85): Promise<string> {
  const result = await manipulateAsync(uri, [], {
    compress: quality,
    format: SaveFormat.JPEG,
  });
  return result.uri;
}
