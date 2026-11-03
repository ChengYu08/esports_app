/**
 * 青少年模式启动锁定页的生效时间窗：
 * 北京时间（UTC+8）下午 17:00 至次日早 6:00 锁定，其余时间不锁定，不影响正常使用。
 * （17:00 为临时测试口径，上线前确认是否恢复 22:00；后端 YouthModeConstant 同步。）
 *
 * 判定输入为 epoch 毫秒（由调用方用服务端时间校准后的「当前时间」传入），
 * 时区固定按 UTC+8 换算，不使用设备时区——防止改设备时区绕过；口径与后端
 * YouthModeLockWindow（Asia/Shanghai）保持一致。
 */
export const TEEN_LOCK_START_HOUR = 17;
export const TEEN_LOCK_END_HOUR = 6;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const BEIJING_OFFSET_MS = 8 * HOUR_MS;

/** epoch 毫秒换算到北京时间的「当天已过毫秒数」（结果恒为 [0, DAY_MS)） */
function beijingMsIntoDay(nowMs: number): number {
  return ((nowMs + BEIJING_OFFSET_MS) % DAY_MS + DAY_MS) % DAY_MS;
}

export function isTeenLockWindow(nowMs: number = Date.now()): boolean {
  const hour = Math.floor(beijingMsIntoDay(nowMs) / HOUR_MS);
  return hour >= TEEN_LOCK_START_HOUR || hour < TEEN_LOCK_END_HOUR;
}

/** 距下一个时间窗边界（北京时间 17:00 / 06:00）的毫秒数，用于 App 长时间停留时跨边界重新判定。 */
export function msUntilTeenLockBoundary(nowMs: number = Date.now()): number {
  const intoDay = beijingMsIntoDay(nowMs);
  const start = TEEN_LOCK_START_HOUR * HOUR_MS;
  const end = TEEN_LOCK_END_HOUR * HOUR_MS;
  if (intoDay < end) {
    return end - intoDay;
  }
  if (intoDay < start) {
    return start - intoDay;
  }
  return DAY_MS - intoDay + end;
}
