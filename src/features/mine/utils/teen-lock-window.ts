/**
 * 青少年模式启动锁定页的生效时间窗：
 * 时段只以服务端配置（/youth/config，Nacos 下发）为准，客户端不设任何兜底时段。
 * 形态由服务端 mode 显式声明：same-day 本日锁定（start < end）、cross-day 跨日锁定（start > end）。
 * 服务端返回 lockEnabled=false 或配置非法时锁定解除（disabled）；请求失败保持 unknown（fail-closed）。
 *
 * 判定输入为 epoch 毫秒（由调用方用服务端时间校准后的「当前时间」传入），
 * 时区固定按 UTC+8 换算，不使用设备时区——防止改设备时区绕过；口径与后端
 * YouthModeLockWindow / YouthModeSchedule（Asia/Shanghai）保持一致。
 */
export type TeenLockMode = "same-day" | "cross-day";

export type TeenLockWindow = {
  mode: TeenLockMode;
  startHour: number;
  endHour: number;
};

/**
 * 锁定配置状态：
 * - unknown：尚未取得可信配置（请求中/失败），已开启账号按 fail-closed 锁定；
 * - disabled：服务端明确未配置或配置非法，锁定解除；
 * - TeenLockWindow：有效时段。
 */
export type TeenLockConfigState = "unknown" | "disabled" | TeenLockWindow;

/** 服务端 /youth/config 结构（lockEnabled 缺失视为未配置） */
export type TeenLockConfigResponse = {
  lockEnabled?: boolean;
  mode?: string;
  lockStartHour?: number;
  lockEndHour?: number;
};

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const BEIJING_OFFSET_MS = 8 * HOUR_MS;

/** epoch 毫秒换算到北京时间的「当天已过毫秒数」（结果恒为 [0, DAY_MS)） */
function beijingMsIntoDay(nowMs: number): number {
  return ((nowMs + BEIJING_OFFSET_MS) % DAY_MS + DAY_MS) % DAY_MS;
}

/** 把服务端配置解析成锁定状态：未生效或非法一律 disabled，与服务端口径一致 */
export function resolveTeenLockConfig(
  config: TeenLockConfigResponse | null | undefined,
): TeenLockConfigState {
  if (!config || config.lockEnabled !== true) {
    return "disabled";
  }
  const mode = config.mode;
  const startHour = Number(config.lockStartHour);
  const endHour = Number(config.lockEndHour);
  if (mode !== "same-day" && mode !== "cross-day") {
    return "disabled";
  }
  if (
    !Number.isInteger(startHour) || startHour < 0 || startHour > 23
    || !Number.isInteger(endHour) || endHour < 0 || endHour > 23
  ) {
    return "disabled";
  }
  if (mode === "same-day" && startHour >= endHour) {
    return "disabled";
  }
  if (mode === "cross-day" && startHour <= endHour) {
    return "disabled";
  }
  return { mode, startHour, endHour };
}

export function isTeenLockWindow(nowMs: number, window: TeenLockWindow): boolean {
  const hour = Math.floor(beijingMsIntoDay(nowMs) / HOUR_MS);
  if (window.mode === "cross-day") {
    return hour >= window.startHour || hour < window.endHour;
  }
  return hour >= window.startHour && hour < window.endHour;
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

/**
 * 锁定判定：
 * - 未开启或服务端明确未配置时段 → 不锁；
 * - 配置未知（请求中/失败）→ fail-closed，已开启账号锁定，防止断网或屏蔽配置接口绕过；
 * - 配置有效但没有可信时间 → fail-closed，不退回设备时间。
 */
export function shouldLockTeenMode(
  enabled: boolean,
  calibratedNow: number | null,
  config: TeenLockConfigState,
): boolean {
  if (!enabled || config === "disabled") {
    return false;
  }
  if (config === "unknown") {
    return true;
  }
  return calibratedNow === null || isTeenLockWindow(calibratedNow, config);
}

/** 距下一个时间窗边界的毫秒数，用于 App 长时间停留时跨边界重新判定。 */
export function msUntilTeenLockBoundary(
  nowMs: number,
  window: TeenLockWindow,
): number {
  const intoDay = beijingMsIntoDay(nowMs);
  const boundaries = [window.startHour * HOUR_MS, window.endHour * HOUR_MS];
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

/** 锁定时段展示文案（如 "9:00-18:00"、"22:00-次日6:00"），开启成功 toast 与说明页共用。 */
export function teenLockWindowLabel(window: TeenLockWindow): string {
  if (window.mode === "cross-day") {
    return `${window.startHour}:00-次日${window.endHour}:00`;
  }
  return `${window.startHour}:00-${window.endHour}:00`;
}
