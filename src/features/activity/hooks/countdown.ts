/** 倒计时纯逻辑：serverTime 校准 offset + 本地心跳推进，独立于 React/网络以便测试。 */

/** 倒计时状态：本地时钟读数 + 服务端校准 offset。 */
export type CountdownState = {
  /** 本地时钟读数（ms）。 */
  nowMs: number;
  /** 服务端时钟 offset（serverTime - 本地时钟），serverTime 到达时计算一次后保持稳定。 */
  offsetMs: number;
};

/**
 * 初始化/校准倒计时状态：serverTime 数据到达时只计算一次 offset。
 * serverTime 缺失或非法时 offset 为 0（按本地时钟）。
 */
export function initCountdownState(
  serverTime: string | undefined,
  localNowMs: number,
): CountdownState {
  const serverMs = serverTime ? Date.parse(serverTime) : Number.NaN;
  return {
    nowMs: localNowMs,
    offsetMs: Number.isFinite(serverMs) ? serverMs - localNowMs : 0,
  };
}

/**
 * 心跳 tick：仅推进本地时钟，offset 保持稳定。
 * 若在 tick 内重算 offset，nowMs + offsetMs 恒等于 serverTime，倒计时会冻结。
 */
export function tickCountdown(state: CountdownState, localNowMs: number): CountdownState {
  return { ...state, nowMs: localNowMs };
}

/** 服务端当前时间 = 本地时钟读数 + 校准 offset。 */
export function getServerNowMs(state: CountdownState): number {
  return state.nowMs + state.offsetMs;
}

/** 剩余毫秒数格式化为 HH:mm:ss（小时可超过两位）。 */
export function formatCountdown(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}
