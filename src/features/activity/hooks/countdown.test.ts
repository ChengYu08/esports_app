import { describe, expect, it } from "vitest";

import { computeActivityStatus } from "../activity-status";
import {
  formatCountdown,
  getServerNowMs,
  initCountdownState,
  tickCountdown,
} from "./countdown";

const START_TIME = "2026-10-20T10:00:00+08:00";
const END_TIME = "2026-10-20T12:00:00+08:00";
const SERVER_NOW = Date.parse("2026-10-20T11:00:00+08:00");
// 本地时钟比服务端慢 5 分钟（serverTime 已到，本地未到）。
const LOCAL_NOW = SERVER_NOW - 5 * 60 * 1000;
const endMs = Date.parse(END_TIME);

function buildDetail(overrides: Partial<Parameters<typeof computeActivityStatus>[0]> = {}) {
  return {
    startTime: START_TIME,
    endTime: END_TIME,
    remainingStock: 5,
    buttonStatus: "ACTIVE" as const,
    ...overrides,
  };
}

describe("倒计时时间推进（initCountdownState / tickCountdown）", () => {
  it("serverTime 到达时 offset 只计算一次：offset = serverTime - 本地时钟", () => {
    const state = initCountdownState("2026-10-20T11:00:00+08:00", LOCAL_NOW);

    expect(state.offsetMs).toBe(SERVER_NOW - LOCAL_NOW);
    expect(getServerNowMs(state)).toBe(SERVER_NOW);
  });

  it("serverTime 缺失或非法时 offset 为 0（按本地时钟）", () => {
    expect(initCountdownState(undefined, LOCAL_NOW).offsetMs).toBe(0);
    expect(initCountdownState("not-a-date", LOCAL_NOW).offsetMs).toBe(0);
  });

  it("同一 serverTime 下多次 tick，服务端时间严格递增（offset 保持稳定）", () => {
    let state = initCountdownState("2026-10-20T11:00:00+08:00", LOCAL_NOW);
    const serverNows: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      serverNows.push(getServerNowMs(state));
      // 每次心跳本地时钟前进 1s，offset 不重算。
      state = tickCountdown(state, state.nowMs + 1000);
    }

    expect(state.offsetMs).toBe(SERVER_NOW - LOCAL_NOW);
    for (let i = 1; i < serverNows.length; i += 1) {
      expect(serverNows[i]).toBeGreaterThan(serverNows[i - 1]);
    }
    expect(serverNows[4]).toBe(SERVER_NOW + 4000);
  });

  it("同一 serverTime 下多次 tick，剩余毫秒严格递减（倒计时不会冻结）", () => {
    let state = initCountdownState("2026-10-20T11:00:00+08:00", LOCAL_NOW);
    const remainings: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      remainings.push(endMs - getServerNowMs(state));
      state = tickCountdown(state, state.nowMs + 1000);
    }

    expect(remainings[0]).toBe(60 * 60 * 1000);
    for (let i = 1; i < remainings.length; i += 1) {
      expect(remainings[i]).toBeLessThan(remainings[i - 1]);
    }
    expect(remainings[4]).toBe(60 * 60 * 1000 - 4000);
  });

  it("跨 endTime 翻转：状态由 ACTIVE 翻为 NOT_STARTED（ENDED 并入约定）", () => {
    const detail = buildDetail();
    // 服务端时间 11:59:58.5，两次 1s tick 后跨过 12:00:00。
    let state = initCountdownState("2026-10-20T11:59:58.500+08:00", LOCAL_NOW);

    const before = computeActivityStatus(detail, state.nowMs, state.offsetMs);
    expect(before).toEqual({ status: "ACTIVE" });

    state = tickCountdown(state, state.nowMs + 1000);
    state = tickCountdown(state, state.nowMs + 1000);

    const after = computeActivityStatus(detail, state.nowMs, state.offsetMs);
    expect(after).toEqual({ status: "NOT_STARTED" });
  });

  it("跨 startTime 翻转：状态由 NOT_STARTED 翻为 ACTIVE", () => {
    const detail = buildDetail();
    // 服务端时间 09:59:58.5，两次 1s tick 后跨过 10:00:00。
    let state = initCountdownState("2026-10-20T09:59:58.500+08:00", LOCAL_NOW);

    const before = computeActivityStatus(detail, state.nowMs, state.offsetMs);
    expect(before).toEqual({ status: "NOT_STARTED" });

    state = tickCountdown(state, state.nowMs + 1000);
    state = tickCountdown(state, state.nowMs + 1000);

    const after = computeActivityStatus(detail, state.nowMs, state.offsetMs);
    expect(after).toEqual({ status: "ACTIVE" });
  });
});

describe("formatCountdown", () => {
  it("按 HH:mm:ss 格式化剩余毫秒", () => {
    expect(formatCountdown(60 * 60 * 1000 - 4000)).toBe("00:59:56");
    expect(formatCountdown(25 * 3600 * 1000 + 5 * 60 * 1000 + 9 * 1000)).toBe("25:05:09");
  });

  it("负数或 0 兜底为 00:00:00", () => {
    expect(formatCountdown(-1)).toBe("00:00:00");
    expect(formatCountdown(0)).toBe("00:00:00");
  });
});
