/**
 * 后端 fastjson 序列化 LocalDateTime 产出的 "yyyy-MM-dd HH:mm:ss" 在 Hermes 上
 * 无法被 new Date 直接解析（返回 Invalid Date），统一归一为 ISO 再解析。
 * 无时区后缀，按设备本地时区解释（与 PC 端行为一致）。
 */
export function parseServerDateTime(value?: string | null): number {
  if (typeof value !== "string" || value.trim() === "") return Number.NaN;
  const normalized = value.trim().replace(/\s+/, "T");
  return new Date(normalized).getTime();
}
