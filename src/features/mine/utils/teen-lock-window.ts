/**
 * 青少年模式启动锁定页的生效时间窗（手机本地时间）：
 * 晚 22:00 至次日早 6:00 锁定，其余时间不锁定，不影响正常使用。
 */
export const TEEN_LOCK_START_HOUR = 22;
export const TEEN_LOCK_END_HOUR = 6;

export function isTeenLockWindow(now: Date = new Date()): boolean {
  const hour = now.getHours();
  return hour >= TEEN_LOCK_START_HOUR || hour < TEEN_LOCK_END_HOUR;
}

/** 距下一个时间窗边界（22:00 / 06:00）的毫秒数，用于 App 长时间停留时跨边界重新判定。 */
export function msUntilTeenLockBoundary(now: Date = new Date()): number {
  const boundaries: number[] = [];
  for (const dayOffset of [0, 1]) {
    for (const hour of [TEEN_LOCK_START_HOUR, TEEN_LOCK_END_HOUR]) {
      const boundary = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + dayOffset,
        hour,
        0,
        0,
        0,
      ).getTime();
      if (boundary > now.getTime()) {
        boundaries.push(boundary);
      }
    }
  }
  return Math.min(...boundaries) - now.getTime();
}
