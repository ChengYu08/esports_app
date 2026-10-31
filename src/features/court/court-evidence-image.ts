import { File } from "expo-file-system";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { detectImageFormat } from "@/shared/media-picker/image-compat";

function readImageFormat(uri: string) {
  const file = new File(uri);
  if (!file.exists || file.size < 12) {
    throw new Error("读取图片失败，请重新选择图片");
  }
  return detectImageFormat(uri);
}

function uploadFile(uri: string, name: string | null | undefined, format: { extension: string; mimeType: string }) {
  const basename = (name || uri.split(/[?#]/)[0]).split(/[\\/]/).pop()?.replace(/\.[^.]*$/, "") || "court-evidence";
  return { uri, name: `${basename}.${format.extension}`, mimeType: format.mimeType };
}

/** 以文件字节识别的格式为准：Android 导出 JPEG 后，仍可能保留原始 HEIC 文件名和 MIME 类型。 */
export function getEvidenceUploadFile(uri: string, name?: string | null) {
  const format = readImageFormat(uri);
  if (!format) {
    throw new Error("图片格式暂不支持，请重新选择图片后上传");
  }
  return uploadFile(uri, name, format);
}

/** 先按文件字节识别格式；不支持的格式（如 HEIC/TIFF）转成 JPEG 缓存文件再上传。 */
export async function preparePickedEvidenceImage(uri: string) {
  const format = readImageFormat(uri);
  if (format) {
    return uploadFile(uri, null, format);
  }
  const converted = await manipulateAsync(uri, [], {
    compress: 0.9,
    format: SaveFormat.JPEG,
  });
  try {
    return getEvidenceUploadFile(converted.uri);
  } catch (error) {
    const file = new File(converted.uri);
    if (file.exists) {
      file.delete();
    }
    throw error;
  }
}
