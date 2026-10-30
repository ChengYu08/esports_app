/**
 * 后端 fastjson 序列化 LocalDateTime 产出的 "yyyy-MM-dd HH:mm:ss"（无时区后缀，
 * 为北京时区 UTC+8 的墙钟时间），在 Hermes 上无法被 new Date 直接解析（返回
 * Invalid Date）。统一按固定 +8 偏移换算为 epoch，与设备本地时区解耦：
 * 若按设备时区解释，设备不在 UTC+8 时倒计时/时效判断会偏差整个时区差。
 */
const SERVER_TZ_OFFSET_MS = 8 * 60 * 60 * 1000;

/** 无时区后缀的日期时间；秒与毫秒可省略 */
const NAIVE_DATE_TIME_RE =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;

export function parseServerDateTime(value?: string | null): number {
  if (typeof value !== "string" || value.trim() === "") return Number.NaN;
  const trimmed = value.trim();
  const match = NAIVE_DATE_TIME_RE.exec(trimmed);
  if (!match) {
    // 已带时区后缀（Z / ±HH:MM 等）或其他格式，交由标准解析
    return new Date(trimmed).getTime();
  }
  const [, y, mo, d, h, mi, s, ms] = match;
  const utcMs = Date.UTC(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    Number(s ?? 0),
    Number(ms ?? 0),
  );
  // Date.UTC 对越界分量（如 13 月、99 时）会静默进位，需回读校验
  const date = new Date(utcMs);
  if (
    date.getUTCFullYear() !== Number(y)
    || date.getUTCMonth() !== Number(mo) - 1
    || date.getUTCDate() !== Number(d)
    || date.getUTCHours() !== Number(h)
    || date.getUTCMinutes() !== Number(mi)
    || date.getUTCSeconds() !== Number(s ?? 0)
  ) {
    return Number.NaN;
  }
  return utcMs - SERVER_TZ_OFFSET_MS;
}
