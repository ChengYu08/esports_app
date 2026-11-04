/**
 * 青少年模式启动锁定页的生效时间窗：
 * 锁定时段起止小时跟随服务端配置（/youth/config，Nacos 动态下发），
 * 须同时支持两种形态：start < end 同日锁定（联调口径 9:00-23:00）、
 * start > end 跨午夜锁定（正式口径 22:00-次日 6:00）；start == end 视为全天锁定。
 * 拉取配置失败时回退默认 9:00-23:00（与服务端默认值一致）。
 *
 * 判定输入为 epoch 毫秒（由调用方用服务端时间校准后的「当前时间」传入），
 * 时区固定按 UTC+8 换算，不使用设备时区——防止改设备时区绕过；口径与后端
 * YouthModeLockWindow（Asia/Shanghai）保持一致。
 */
export const TEEN_DEFAULT_LOCK_START_HOUR = 9;
export const TEEN_DEFAULT_LOCK_END_HOUR = 23;

export type TeenLockWindow = {
  startHour: number;
  endHour: number;
};

export const DEFAULT_TEEN_LOCK_WINDOW: TeenLockWindow = {
  startHour: TEEN_DEFAULT_LOCK_START_HOUR,
  endHour: TEEN_DEFAULT_LOCK_END_HOUR,
};

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const BEIJING_OFFSET_MS = 8 * HOUR_MS;

/** epoch 毫秒换算到北京时间的「当天已过毫秒数」（结果恒为 [0, DAY_MS)） */
function beijingMsIntoDay(nowMs: number): number {
  return ((nowMs + BEIJING_OFFSET_MS) % DAY_MS + DAY_MS) % DAY_MS;
}

export function isTeenLockWindow(
  nowMs: number,
  startHour: number = TEEN_DEFAULT_LOCK_START_HOUR,
  endHour: number = TEEN_DEFAULT_LOCK_END_HOUR,
): boolean {
  const hour = Math.floor(beijingMsIntoDay(nowMs) / HOUR_MS);
  if (startHour === endHour) {
    return true;
  }
  if (startHour < endHour) {
    return hour >= startHour && hour < endHour;
  }
  return hour >= startHour || hour < endHour;
}

export type TeenServerClock = {
  serverTime: number;
  monotonicTime: number;
};

export function createTeenServerClock(
  serverTime: number,
  monotonicTime: number,
): TeenServerClock {
  return { serverTime, monotonicTime };
}

/** 单调时钟只向前推进，设备墙上时间被修改不会影响校准结果。 */
export function readTeenServerClock(
  clock: TeenServerClock,
  monotonicTime: number,
): number {
  return clock.serverTime + monotonicTime - clock.monotonicTime;
}

/** 已开启但没有可信时间时必须 fail-closed，不能退化成设备时间。 */
export function shouldLockTeenMode(
  enabled: boolean,
  calibratedNow: number | null,
  window: TeenLockWindow = DEFAULT_TEEN_LOCK_WINDOW,
): boolean {
  return enabled
    && (calibratedNow === null || isTeenLockWindow(calibratedNow, window.startHour, window.endHour));
}

/** 距下一个时间窗边界的毫秒数，用于 App 长时间停留时跨边界重新判定。 */
export function msUntilTeenLockBoundary(
  nowMs: number = Date.now(),
  startHour: number = TEEN_DEFAULT_LOCK_START_HOUR,
  endHour: number = TEEN_DEFAULT_LOCK_END_HOUR,
): number {
  const intoDay = beijingMsIntoDay(nowMs);
  const boundaries = [startHour * HOUR_MS, endHour * HOUR_MS];
  let next = Infinity;
  for (const boundary of boundaries) {
    if (boundary - intoDay > 0 && boundary - intoDay < next) {
      next = boundary - intoDay;
    }
  }
  if (next !== Infinity) {
    return next;
  }
  return DAY_MS - intoDay + Math.min(...boundaries);
}

/** 锁定时段展示文案（如 "9:00-23:00"、"22:00-次日6:00"），开启成功 toast 与说明页共用。 */
export function teenLockWindowLabel(
  startHour: number = TEEN_DEFAULT_LOCK_START_HOUR,
  endHour: number = TEEN_DEFAULT_LOCK_END_HOUR,
): string {
  if (startHour > endHour) {
    return `${startHour}:00-次日${endHour}:00`;
  }
  return `${startHour}:00-${endHour}:00`;
}
