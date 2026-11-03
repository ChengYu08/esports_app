import { describe, expect, it } from "vitest";

import { isTeenLockWindow, msUntilTeenLockBoundary } from "./teen-lock-window";

function at(hour: number, minute = 0, day = 15) {
  return new Date(2026, 10, day, hour, minute, 0, 0);
}

describe("isTeenLockWindow", () => {
  it("22:00 起锁定", () => {
    expect(isTeenLockWindow(at(22, 0))).toBe(true);
  });

  it("深夜与凌晨锁定", () => {
    expect(isTeenLockWindow(at(23, 59))).toBe(true);
    expect(isTeenLockWindow(at(0, 30))).toBe(true);
    expect(isTeenLockWindow(at(5, 59))).toBe(true);
  });

  it("06:00 起不再锁定", () => {
    expect(isTeenLockWindow(at(6, 0))).toBe(false);
    expect(isTeenLockWindow(at(12, 0))).toBe(false);
    expect(isTeenLockWindow(at(21, 59))).toBe(false);
  });
});

describe("msUntilTeenLockBoundary", () => {
  it("白天指向当天 22:00", () => {
    expect(msUntilTeenLockBoundary(at(12, 0))).toBe(10 * 60 * 60 * 1000);
  });

  it("凌晨指向当天 06:00", () => {
    expect(msUntilTeenLockBoundary(at(1, 0))).toBe(5 * 60 * 60 * 1000);
  });

  it("锁定窗口内指向次日 06:00", () => {
    expect(msUntilTeenLockBoundary(at(22, 0))).toBe(8 * 60 * 60 * 1000);
  });

  it("恰好命中边界时指向下一个边界", () => {
    expect(msUntilTeenLockBoundary(at(6, 0))).toBe(16 * 60 * 60 * 1000);
  });

  it("22:00 前一分钟指向当天 22:00", () => {
    expect(msUntilTeenLockBoundary(at(21, 59))).toBe(60 * 1000);
  });

  it("23:59 指向次日 06:00（跨零点）", () => {
    expect(msUntilTeenLockBoundary(at(23, 59))).toBe(
      6 * 60 * 60 * 1000 + 60 * 1000,
    );
  });
});
