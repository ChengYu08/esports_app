/** 下载包完整性判定：后端未提供 md5 → 跳过；本地文件不可读 → 视为损坏 */
export function decideMd5Verification(
  expectedMd5: string | undefined,
  actualMd5: string | null,
): "match" | "mismatch" | "skip" {
  const expected = expectedMd5?.trim().toLowerCase();
  if (!expected) return "skip";
  if (actualMd5 === null) return "mismatch";
  const actual = actualMd5.trim().toLowerCase();
  return actual === expected ? "match" : "mismatch";
}
