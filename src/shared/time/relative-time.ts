import { parseServerDateTime } from "./server-date";

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
/** 与后端约定的北京时区偏移，日界与 HH:mm 均按北京墙钟计算，与设备时区解耦。 */
const BEIJING_OFFSET_MS = 8 * HOUR_MS;
/** 超过该天数后退化为日期展示。 */
const RELATIVE_DAY_LIMIT = 7;

/** 时间戳对应的北京时区日序号（北京零点为日界）。 */
function beijingDayIndex(epoch: number): number {
  return Math.floor((epoch + BEIJING_OFFSET_MS) / DAY_MS);
}

/** 按北京时区墙钟取 HH:mm。 */
function beijingClock(epoch: number): string {
  const date = new Date(epoch + BEIJING_OFFSET_MS);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

/** 按北京时区墙钟取 yyyy-MM-dd。 */
function beijingDate(epoch: number): string {
  const date = new Date(epoch + BEIJING_OFFSET_MS);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/**
 * 盼友圈相对时间展示：
 * 一分钟内 → 刚刚；一小时内 → N分钟前；当天 → N小时前；
 * 昨天 → 昨天 HH:mm；7 天内 → N天前；更早 → yyyy-MM-dd。
 * 无法解析时原样返回，便于透传后端已格式化好的描述串。
 */
export function formatRelativeTime(value?: string | null, now: number = Date.now()): string {
  if (typeof value !== "string" || value.trim() === "") {
    return "";
  }
  const epoch = parseServerDateTime(value);
  if (!Number.isFinite(epoch)) {
    return value;
  }
  const diff = now - epoch;
  if (diff < MINUTE_MS) {
    return "刚刚";
  }
  if (diff < HOUR_MS) {
    return `${Math.floor(diff / MINUTE_MS)}分钟前`;
  }
  const dayGap = beijingDayIndex(now) - beijingDayIndex(epoch);
  if (dayGap === 0) {
    return `${Math.floor(diff / HOUR_MS)}小时前`;
  }
  if (dayGap === 1) {
    return `昨天 ${beijingClock(epoch)}`;
  }
  if (dayGap < RELATIVE_DAY_LIMIT) {
    return `${dayGap}天前`;
  }
  return beijingDate(epoch);
}
