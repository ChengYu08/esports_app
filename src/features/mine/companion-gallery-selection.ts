type ImageFile = { fileName?: string | null; mimeType?: string | null; fileSize: number };

// 技能截图仅支持 JPG/PNG/WebP；gif 等动图格式不允许上传。
const SUPPORTED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);
const SUPPORTED_EXTENSIONS = /\.(jpe?g|png|webp)$/;

function isSupportedImage(file: ImageFile): boolean {
  const mimeType = file.mimeType?.toLowerCase();
  if (mimeType) {
    return SUPPORTED_MIME_TYPES.has(mimeType);
  }
  // 无 MIME 类型时回退到文件名后缀判断（iOS 相册资源常见）。
  return SUPPORTED_EXTENSIONS.test(file.fileName?.toLowerCase() ?? "");
}

export function selectCompanionImages<T extends ImageFile>(files: T[]) {
  const accepted: T[] = [];
  const warnings: string[] = [];
  for (const file of files) {
    if (!isSupportedImage(file)) {
      warnings.push(`${file.fileName || "图片"}格式不支持，仅支持 JPG/PNG/WebP`);
    } else if (file.fileSize > 2 * 1024 * 1024) {
      warnings.push(`${file.fileName || "图片"}超过2MB，已跳过`);
    } else {
      accepted.push(file);
    }
  }
  return { accepted, warnings };
}
