import { router } from "expo-router";
import { convertToJpeg, detectImageFormat } from "@/shared/media-picker/image-compat";
import { beginMediaPick } from "@/shared/media-picker/media-picker-session";

export type CompanionGalleryImage = {
  uri: string;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
};

function inferImageMimeType(fileName: string | null): string | null {
  const suffix = fileName?.split(".").pop()?.toLowerCase();
  if (suffix === "jpg" || suffix === "jpeg") return "image/jpeg";
  if (suffix === "png") return "image/png";
  if (suffix === "webp") return "image/webp";
  return null;
}

function toGalleryImage(uri: string): CompanionGalleryImage {
  const fileName = uri.split(/[?#]/)[0].split(/[\\/]/).pop() ?? null;
  return {
    uri,
    fileName,
    fileSize: null,
    mimeType: inferImageMimeType(fileName),
  };
}

/** 打开通用相册选择页多选取图（权限在选择页内处理），取消时返回空数组。 */
export async function pickCompanionGalleryImages(
  selectionLimit: number,
): Promise<CompanionGalleryImage[]> {
  const pickPending = beginMediaPick();
  router.push({
    pathname: "/media-picker",
    params: { max: String(Math.max(1, selectionLimit)) },
  });
  const picked = await pickPending;
  if (!picked?.length) {
    return [];
  }
  const result: CompanionGalleryImage[] = [];
  for (const uri of picked.slice(0, selectionLimit)) {
    // iOS 相机默认 HEIC 不在 JPG/PNG/WebP 白名单内，转成 JPEG 再走选择校验
    if (detectImageFormat(uri)) {
      result.push(toGalleryImage(uri));
    } else {
      result.push(toGalleryImage(await convertToJpeg(uri, 0.9)));
    }
  }
  return result;
}
