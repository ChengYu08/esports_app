import { describe, expect, it } from "vitest";

import {
  TEEN_DEFAULT_LOCK_END_HOUR,
  TEEN_DEFAULT_LOCK_START_HOUR,
  createTeenServerClock,
  isTeenLockWindow,
  msUntilTeenLockBoundary,
  readTeenServerClock,
  shouldLockTeenMode,
  teenLockWindowLabel,
} from "./teen-lock-window";

/** 北京时间 2026-11-15 指定时刻对应的 epoch 毫秒（用 UTC 构造，跑测试的机器时区不影响结果） */
function beijingAt(hour: number, minute = 0, day = 15) {
  return Date.UTC(2026, 10, day, hour - 8, minute, 0, 0);
}

const HOUR_MS = 60 * 60 * 1000;

describe("默认锁定窗口", () => {
  it("默认值为服务端联调口径 9:00-23:00", () => {
    expect(TEEN_DEFAULT_LOCK_START_HOUR).toBe(9);
    expect(TEEN_DEFAULT_LOCK_END_HOUR).toBe(23);
  });
});

describe("isTeenLockWindow（同日形态 9-23）", () => {
  it("北京时间 9:00 起锁定", () => {
    expect(isTeenLockWindow(beijingAt(9, 0), 9, 23)).toBe(true);
  });

  it("8:59 尚未锁定", () => {
    expect(isTeenLockWindow(beijingAt(8, 59), 9, 23)).toBe(false);
  });

  it("白天与晚间均锁定", () => {
    expect(isTeenLockWindow(beijingAt(12, 0), 9, 23)).toBe(true);
    expect(isTeenLockWindow(beijingAt(17, 0), 9, 23)).toBe(true);
    expect(isTeenLockWindow(beijingAt(22, 0), 9, 23)).toBe(true);
  });

  it("22:59 仍在锁定时段", () => {
    expect(isTeenLockWindow(beijingAt(22, 59), 9, 23)).toBe(true);
  });

  it("北京时间 23:00 起不再锁定", () => {
    expect(isTeenLockWindow(beijingAt(23, 0), 9, 23)).toBe(false);
    expect(isTeenLockWindow(beijingAt(23, 59), 9, 23)).toBe(false);
    expect(isTeenLockWindow(beijingAt(0, 30), 9, 23)).toBe(false);
    expect(isTeenLockWindow(beijingAt(5, 59), 9, 23)).toBe(false);
  });
});

describe("isTeenLockWindow（跨午夜形态 22-6 回归）", () => {
  it("22:00 起锁定", () => {
    expect(isTeenLockWindow(beijingAt(22, 0), 22, 6)).toBe(true);
    expect(isTeenLockWindow(beijingAt(23, 59), 22, 6)).toBe(true);
    expect(isTeenLockWindow(beijingAt(0, 30), 22, 6)).toBe(true);
    expect(isTeenLockWindow(beijingAt(5, 59), 22, 6)).toBe(true);
  });

  it("21:59 与 6:00 起不锁定", () => {
    expect(isTeenLockWindow(beijingAt(21, 59), 22, 6)).toBe(false);
    expect(isTeenLockWindow(beijingAt(6, 0), 22, 6)).toBe(false);
    expect(isTeenLockWindow(beijingAt(12, 0), 22, 6)).toBe(false);
  });
});

describe("isTeenLockWindow（形态边界）", () => {
  it("起始与结束相同时视为全天锁定", () => {
    expect(isTeenLockWindow(beijingAt(0, 0), 9, 9)).toBe(true);
    expect(isTeenLockWindow(beijingAt(12, 0), 9, 9)).toBe(true);
    expect(isTeenLockWindow(beijingAt(23, 0), 9, 9)).toBe(true);
  });

  it("判定与设备时区无关：同一 epoch 在任何时区结果一致（固定 UTC+8 换算）", () => {
    // 北京 9:00 = UTC 01:00 = 纽约 20:00；即便设备时区是纽约也必须判锁定
    const beijing0900 = beijingAt(9, 0);
    expect(new Date(beijing0900).toISOString()).toBe("2026-11-15T01:00:00.000Z");
    expect(isTeenLockWindow(beijing0900, 9, 23)).toBe(true);
  });

  it("负偏移（校准后的时间早于 1970）也能正确取模", () => {
    // -1ms 是北京 07:59:59.999，9-23 窗外
    expect(isTeenLockWindow(-1, 9, 23)).toBe(false);
  });
});

describe("服务端校准时钟", () => {
  it("只按单调时钟推进，不读取可被修改的设备墙上时间", () => {
    const clock = createTeenServerClock(beijingAt(22, 0), 1_000);

    expect(readTeenServerClock(clock, 1_000)).toBe(beijingAt(22, 0));
    expect(readTeenServerClock(clock, 61_000)).toBe(beijingAt(22, 1));
  });

  it("已开启但尚无可信服务端时间时保持锁定", () => {
    expect(shouldLockTeenMode(true, null, { startHour: 9, endHour: 23 })).toBe(true);
    expect(shouldLockTeenMode(false, null, { startHour: 9, endHour: 23 })).toBe(false);
    expect(shouldLockTeenMode(true, beijingAt(0, 30), { startHour: 9, endHour: 23 })).toBe(false);
    expect(shouldLockTeenMode(true, beijingAt(12, 0), { startHour: 9, endHour: 23 })).toBe(true);
  });
});

describe("msUntilTeenLockBoundary（同日形态 9-23）", () => {
  it("凌晨指向当天 9:00", () => {
    expect(msUntilTeenLockBoundary(beijingAt(1, 0), 9, 23)).toBe(8 * HOUR_MS);
  });

  it("锁定窗口内指向当天 23:00", () => {
    expect(msUntilTeenLockBoundary(beijingAt(9, 0), 9, 23)).toBe(14 * HOUR_MS);
    expect(msUntilTeenLockBoundary(beijingAt(12, 0), 9, 23)).toBe(11 * HOUR_MS);
  });

  it("恰好命中边界时指向下一个边界", () => {
    expect(msUntilTeenLockBoundary(beijingAt(23, 0), 9, 23)).toBe(10 * HOUR_MS);
  });

  it("8:59 前一分钟指向当天 9:00", () => {
    expect(msUntilTeenLockBoundary(beijingAt(8, 59), 9, 23)).toBe(60 * 1000);
  });

  it("22:59 指向当天 23:00", () => {
    expect(msUntilTeenLockBoundary(beijingAt(22, 59), 9, 23)).toBe(60 * 1000);
  });

  it("23:59 指向次日 9:00（跨零点）", () => {
    expect(msUntilTeenLockBoundary(beijingAt(23, 59), 9, 23)).toBe(
      9 * HOUR_MS + 60 * 1000,
    );
  });
});

describe("msUntilTeenLockBoundary（跨午夜形态 22-6 回归）", () => {
  it("白天指向当天 22:00", () => {
    expect(msUntilTeenLockBoundary(beijingAt(12, 0), 22, 6)).toBe(10 * HOUR_MS);
  });

  it("凌晨指向当天 06:00", () => {
    expect(msUntilTeenLockBoundary(beijingAt(1, 0), 22, 6)).toBe(5 * HOUR_MS);
  });

  it("锁定窗口内指向次日 06:00", () => {
    expect(msUntilTeenLockBoundary(beijingAt(22, 0), 22, 6)).toBe(8 * HOUR_MS);
    expect(msUntilTeenLockBoundary(beijingAt(23, 59), 22, 6)).toBe(
      6 * HOUR_MS + 60 * 1000,
    );
  });

  it("恰好命中边界时指向下一个边界", () => {
    expect(msUntilTeenLockBoundary(beijingAt(6, 0), 22, 6)).toBe(16 * HOUR_MS);
  });
});

describe("teenLockWindowLabel", () => {
  it("同日形态不带次日字样", () => {
    expect(teenLockWindowLabel(9, 23)).toBe("9:00-23:00");
  });

  it("跨午夜形态带次日字样", () => {
    expect(teenLockWindowLabel(22, 6)).toBe("22:00-次日6:00");
  });
});
