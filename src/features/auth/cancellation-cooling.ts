export type CoolingRecord = {
  phone: string;
  /** 冷静期截止时间戳（毫秒） */
  coolEndTime: number;
  coolingDays: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function buildCoolingRecord(
  phone: string,
  startedAt: number,
  coolingDays: number,
): CoolingRecord {
  return {
    phone,
    coolEndTime: startedAt + Math.max(coolingDays, 1) * DAY_MS,
    coolingDays: Math.max(coolingDays, 1),
  };
}

/** 解析服务端下发的冷静期截止时间（yyyy-MM-dd HH:mm:ss），无效返回 null */
export function parseCoolEndTime(raw: string | null | undefined) {
  if (!raw) {
    return null;
  }
  const timestamp = new Date(raw.replace(" ", "T")).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function formatCoolEndTime(timestamp: number) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日${date.getHours()}时${String(date.getMinutes()).padStart(2, "0")}分`;
}

export function isCoolingActive(
  record: CoolingRecord | null,
  now = Date.now(),
): record is CoolingRecord {
  return record !== null && now < record.coolEndTime;
}
