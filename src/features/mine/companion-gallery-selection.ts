type ImageFile = { fileName?: string | null; fileSize: number };

export function selectCompanionImages<T extends ImageFile>(files: T[]) {
  const accepted: T[] = [];
  const warnings: string[] = [];
  for (const file of files) {
    if (file.fileSize > 2 * 1024 * 1024) {
      warnings.push(`${file.fileName || "图片"}超过2MB，已跳过`);
    } else {
      accepted.push(file);
    }
  }
  return { accepted, warnings };
}
