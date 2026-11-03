import { describe, expect, it } from "vitest";

import { isTeenLockWindow, msUntilTeenLockBoundary } from "./teen-lock-window";

/** 北京时间 2026-11-15 指定时刻对应的 epoch 毫秒（用 UTC 构造，跑测试的机器时区不影响结果） */
function beijingAt(hour: number, minute = 0, day = 15) {
  return Date.UTC(2026, 10, day, hour - 8, minute, 0, 0);
}

describe("isTeenLockWindow", () => {
  it("北京时间 17:00 起锁定", () => {
    expect(isTeenLockWindow(beijingAt(17, 0))).toBe(true);
  });

  it("16:59 尚未锁定", () => {
    expect(isTeenLockWindow(beijingAt(16, 59))).toBe(false);
  });

  it("深夜与凌晨锁定", () => {
    expect(isTeenLockWindow(beijingAt(22, 0))).toBe(true);
    expect(isTeenLockWindow(beijingAt(23, 59))).toBe(true);
    expect(isTeenLockWindow(beijingAt(0, 30))).toBe(true);
    expect(isTeenLockWindow(beijingAt(5, 59))).toBe(true);
  });

  it("北京时间 06:00 起不再锁定", () => {
    expect(isTeenLockWindow(beijingAt(6, 0))).toBe(false);
    expect(isTeenLockWindow(beijingAt(12, 0))).toBe(false);
  });

  it("判定与设备时区无关：同一 epoch 在任何时区结果一致（固定 UTC+8 换算）", () => {
    // 北京 17:00 = UTC 09:00 = 纽约 04:00；即便设备时区是纽约也必须判锁定
    const beijing1700 = beijingAt(17, 0);
    expect(new Date(beijing1700).toISOString()).toBe("2026-11-15T09:00:00.000Z");
    expect(isTeenLockWindow(beijing1700)).toBe(true);
  });

  it("负偏移（校准后的时间早于 1970）也能正确取模", () => {
    // -1ms 是北京 07:59:59.999，窗外
    expect(isTeenLockWindow(-1)).toBe(false);
  });
});

describe("msUntilTeenLockBoundary", () => {
  it("白天指向当天 17:00", () => {
    expect(msUntilTeenLockBoundary(beijingAt(12, 0))).toBe(5 * 60 * 60 * 1000);
  });

  it("凌晨指向当天 06:00", () => {
    expect(msUntilTeenLockBoundary(beijingAt(1, 0))).toBe(5 * 60 * 60 * 1000);
  });

  it("锁定窗口内指向次日 06:00", () => {
    expect(msUntilTeenLockBoundary(beijingAt(17, 0))).toBe(13 * 60 * 60 * 1000);
  });

  it("恰好命中边界时指向下一个边界", () => {
    expect(msUntilTeenLockBoundary(beijingAt(6, 0))).toBe(11 * 60 * 60 * 1000);
  });

  it("17:00 前一分钟指向当天 17:00", () => {
    expect(msUntilTeenLockBoundary(beijingAt(16, 59))).toBe(60 * 1000);
  });

  it("23:59 指向次日 06:00（跨零点）", () => {
    expect(msUntilTeenLockBoundary(beijingAt(23, 59))).toBe(
      6 * 60 * 60 * 1000 + 60 * 1000,
    );
  });
});
