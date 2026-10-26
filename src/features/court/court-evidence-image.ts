import { File, FileMode, Paths } from "expo-file-system";
import type { ImagePickerAsset } from "expo-image-picker";

type ImageFormat = { extension: string; mimeType: string };

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

function readImageFormat(file: File) {
  if (!file.exists || file.size < 12) {
    throw new Error("读取图片失败，请重新选择图片");
  }
  const handle = file.open(FileMode.ReadOnly);
  try {
    return imageFormat(handle.readBytes(12));
  } finally {
    handle.close();
  }
}

function uploadFile(uri: string, name: string | null | undefined, format: ImageFormat) {
  const basename = (name || uri.split(/[?#]/)[0]).split(/[\\/]/).pop()?.replace(/\.[^.]*$/, "") || "court-evidence";
  return { uri, name: `${basename}.${format.extension}`, mimeType: format.mimeType };
}

/** 以文件字节识别的格式为准：Android 导出 JPEG 后，仍可能保留原始 HEIC 文件名和 MIME 类型。 */
export function getEvidenceUploadFile(uri: string, name?: string | null) {
  const format = readImageFormat(new File(uri));
  if (!format) {
    throw new Error("图片格式暂不支持，请重新选择图片后上传");
  }
  return uploadFile(uri, name, format);
}

/** SDK 57 的图片选择器即使保留 HEIC/TIFF 文件，也会导出 JPEG 格式的 Base64 数据。 */
export function preparePickedEvidenceImage(asset: Pick<ImagePickerAsset, "uri" | "fileName" | "base64">) {
  const format = readImageFormat(new File(asset.uri));
  if (format) {
    return uploadFile(asset.uri, asset.fileName, format);
  }
  if (!asset.base64?.startsWith("/9j/")) {
    throw new Error("这张图片无法转换，请选择其他图片或截图后上传");
  }

  // 写入实际导出的 JPEG 数据；仅将 HEIC 文件后缀改成 .jpg，仍无法通过服务端校验。
  const converted = new File(Paths.cache, `court-evidence-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`);
  try {
    converted.create();
    converted.write(asset.base64, { encoding: "base64" });
    return getEvidenceUploadFile(converted.uri, asset.fileName);
  } catch (error) {
    if (converted.exists) {
      converted.delete();
    }
    throw error;
  }
}
