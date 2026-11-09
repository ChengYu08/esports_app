import { describe, expect, it } from "vitest";

import {
  createTeenServerClock,
  isTeenLockWindow,
  msUntilTeenLockBoundary,
  readTeenServerClock,
  resolveTeenLockConfig,
  shouldLockTeenMode,
  teenLockWindowLabel,
  type TeenLockWindow,
} from "./teen-lock-window";

/** 北京时间 2026-11-15 指定时刻对应的 epoch 毫秒（用 UTC 构造，跑测试的机器时区不影响结果） */
function beijingAt(hour: number, minute = 0, day = 15) {
  return Date.UTC(2026, 10, day, hour - 8, minute, 0, 0);
}

const HOUR_MS = 60 * 60 * 1000;

const SAME_DAY: TeenLockWindow = { mode: "same-day", startHour: 9, endHour: 18 };
const CROSS_DAY: TeenLockWindow = { mode: "cross-day", startHour: 22, endHour: 6 };
const ALWAYS: TeenLockWindow = { mode: "always", startHour: 0, endHour: 0 };

describe("resolveTeenLockConfig", () => {
  it("服务端配置有效时解析出时段", () => {
    expect(resolveTeenLockConfig({
      lockEnabled: true,
      mode: "same-day",
      lockStartHour: 9,
      lockEndHour: 18,
    })).toEqual(SAME_DAY);
    expect(resolveTeenLockConfig({
      lockEnabled: true,
      mode: "cross-day",
      lockStartHour: 22,
      lockEndHour: 6,
    })).toEqual(CROSS_DAY);
  });

  it("mode=always 全天锁定，无需起止小时", () => {
    expect(resolveTeenLockConfig({ lockEnabled: true, mode: "always" })).toEqual(ALWAYS);
  });

  it("mode=always 忽略残留或越界的小时配置", () => {
    expect(resolveTeenLockConfig({
      lockEnabled: true,
      mode: "always",
      lockStartHour: 22,
      lockEndHour: 6,
    })).toEqual(ALWAYS);
    expect(resolveTeenLockConfig({
      lockEnabled: true,
      mode: "always",
      lockStartHour: 24,
      lockEndHour: -1,
    })).toEqual(ALWAYS);
  });

  it("lockEnabled=false 或缺失时视为未配置（锁定解除）", () => {
    expect(resolveTeenLockConfig({ lockEnabled: false })).toBe("disabled");
    expect(resolveTeenLockConfig({
      mode: "same-day",
      lockStartHour: 9,
      lockEndHour: 18,
    })).toBe("disabled");
    expect(resolveTeenLockConfig(null)).toBe("disabled");
    expect(resolveTeenLockConfig(undefined)).toBe("disabled");
  });

  it("mode 缺失、非法或与起止小时矛盾时视为未配置", () => {
    expect(resolveTeenLockConfig({
      lockEnabled: true,
      lockStartHour: 9,
      lockEndHour: 18,
    })).toBe("disabled");
    expect(resolveTeenLockConfig({
      lockEnabled: true,
      mode: "daily" as never,
      lockStartHour: 9,
      lockEndHour: 18,
    })).toBe("disabled");
    expect(resolveTeenLockConfig({
      lockEnabled: true,
      mode: "same-day",
      lockStartHour: 18,
      lockEndHour: 9,
    })).toBe("disabled");
    expect(resolveTeenLockConfig({
      lockEnabled: true,
      mode: "same-day",
      lockStartHour: 9,
      lockEndHour: 9,
    })).toBe("disabled");
    expect(resolveTeenLockConfig({
      lockEnabled: true,
      mode: "cross-day",
      lockStartHour: 6,
      lockEndHour: 22,
    })).toBe("disabled");
  });

  it("小时缺失或越界时视为未配置", () => {
    expect(resolveTeenLockConfig({
      lockEnabled: true,
      mode: "same-day",
      lockEndHour: 18,
    })).toBe("disabled");
    expect(resolveTeenLockConfig({
      lockEnabled: true,
      mode: "same-day",
      lockStartHour: -1,
      lockEndHour: 18,
    })).toBe("disabled");
    expect(resolveTeenLockConfig({
      lockEnabled: true,
      mode: "same-day",
      lockStartHour: 9,
      lockEndHour: 24,
    })).toBe("disabled");
  });
});

describe("isTeenLockWindow（本日形态 9-18）", () => {
  it("北京时间 9:00 起锁定", () => {
    expect(isTeenLockWindow(beijingAt(9, 0), SAME_DAY)).toBe(true);
  });

  it("8:59 尚未锁定", () => {
    expect(isTeenLockWindow(beijingAt(8, 59), SAME_DAY)).toBe(false);
  });

  it("时段内均锁定", () => {
    expect(isTeenLockWindow(beijingAt(12, 0), SAME_DAY)).toBe(true);
    expect(isTeenLockWindow(beijingAt(17, 59), SAME_DAY)).toBe(true);
  });

  it("北京时间 18:00 起不再锁定", () => {
    expect(isTeenLockWindow(beijingAt(18, 0), SAME_DAY)).toBe(false);
    expect(isTeenLockWindow(beijingAt(23, 59), SAME_DAY)).toBe(false);
    expect(isTeenLockWindow(beijingAt(0, 30), SAME_DAY)).toBe(false);
  });
});

describe("isTeenLockWindow（跨日形态 22-6）", () => {
  it("22:00 起锁定", () => {
    expect(isTeenLockWindow(beijingAt(22, 0), CROSS_DAY)).toBe(true);
    expect(isTeenLockWindow(beijingAt(23, 59), CROSS_DAY)).toBe(true);
    expect(isTeenLockWindow(beijingAt(0, 30), CROSS_DAY)).toBe(true);
    expect(isTeenLockWindow(beijingAt(5, 59), CROSS_DAY)).toBe(true);
  });

  it("21:59 与 6:00 起不锁定", () => {
    expect(isTeenLockWindow(beijingAt(21, 59), CROSS_DAY)).toBe(false);
    expect(isTeenLockWindow(beijingAt(6, 0), CROSS_DAY)).toBe(false);
    expect(isTeenLockWindow(beijingAt(12, 0), CROSS_DAY)).toBe(false);
  });
});

describe("isTeenLockWindow（全天形态）", () => {
  it("任意时刻均锁定，与小时无关", () => {
    for (const hour of [0, 6, 12, 18, 23]) {
      expect(isTeenLockWindow(beijingAt(hour, 30), ALWAYS)).toBe(true);
    }
    expect(isTeenLockWindow(-1, ALWAYS)).toBe(true);
  });
});

describe("isTeenLockWindow（口径）", () => {
  it("判定与设备时区无关：同一 epoch 在任何时区结果一致（固定 UTC+8 换算）", () => {
    // 北京 9:00 = UTC 01:00 = 纽约 20:00；即便设备时区是纽约也必须判锁定
    const beijing0900 = beijingAt(9, 0);
    expect(new Date(beijing0900).toISOString()).toBe("2026-11-15T01:00:00.000Z");
    expect(isTeenLockWindow(beijing0900, SAME_DAY)).toBe(true);
  });

  it("负偏移（校准后的时间早于 1970）也能正确取模", () => {
    // -1ms 是北京 07:59:59.999，9-18 窗外
    expect(isTeenLockWindow(-1, SAME_DAY)).toBe(false);
  });
});

describe("服务端校准时钟", () => {
  it("只按单调时钟推进，不读取可被修改的设备墙上时间", () => {
    const clock = createTeenServerClock(beijingAt(22, 0), 1_000);

    expect(readTeenServerClock(clock, 1_000)).toBe(beijingAt(22, 0));
    expect(readTeenServerClock(clock, 61_000)).toBe(beijingAt(22, 1));
  });
});

describe("shouldLockTeenMode（三态）", () => {
  it("未开启账号任何配置状态都不锁", () => {
    expect(shouldLockTeenMode(false, beijingAt(12, 0), SAME_DAY)).toBe(false);
    expect(shouldLockTeenMode(false, null, "unknown")).toBe(false);
    expect(shouldLockTeenMode(false, null, "disabled")).toBe(false);
  });

  it("服务端明确未配置时段时解除锁定", () => {
    expect(shouldLockTeenMode(true, beijingAt(12, 0), "disabled")).toBe(false);
    expect(shouldLockTeenMode(true, null, "disabled")).toBe(false);
  });

  it("配置未知（请求中/失败）时保持 fail-closed", () => {
    expect(shouldLockTeenMode(true, beijingAt(12, 0), "unknown")).toBe(true);
    expect(shouldLockTeenMode(true, null, "unknown")).toBe(true);
  });

  it("已开启但尚无可信服务端时间时保持锁定", () => {
    expect(shouldLockTeenMode(true, null, SAME_DAY)).toBe(true);
    expect(shouldLockTeenMode(true, null, CROSS_DAY)).toBe(true);
  });

  it("按有效时段判定", () => {
    expect(shouldLockTeenMode(true, beijingAt(0, 30), SAME_DAY)).toBe(false);
    expect(shouldLockTeenMode(true, beijingAt(12, 0), SAME_DAY)).toBe(true);
    expect(shouldLockTeenMode(true, beijingAt(0, 30), CROSS_DAY)).toBe(true);
    expect(shouldLockTeenMode(true, beijingAt(12, 0), CROSS_DAY)).toBe(false);
  });

  it("全天形态任意时刻均锁定", () => {
    expect(shouldLockTeenMode(true, beijingAt(12, 0), ALWAYS)).toBe(true);
    expect(shouldLockTeenMode(true, beijingAt(23, 0), ALWAYS)).toBe(true);
    expect(shouldLockTeenMode(true, null, ALWAYS)).toBe(true);
  });
});

describe("msUntilTeenLockBoundary（本日形态 9-18）", () => {
  it("凌晨指向当天 9:00", () => {
    expect(msUntilTeenLockBoundary(beijingAt(1, 0), SAME_DAY)).toBe(8 * HOUR_MS);
  });

  it("时段内指向当天 18:00", () => {
    expect(msUntilTeenLockBoundary(beijingAt(9, 0), SAME_DAY)).toBe(9 * HOUR_MS);
    expect(msUntilTeenLockBoundary(beijingAt(12, 0), SAME_DAY)).toBe(6 * HOUR_MS);
  });

  it("恰好命中结束边界时指向次日 9:00", () => {
    expect(msUntilTeenLockBoundary(beijingAt(18, 0), SAME_DAY)).toBe(15 * HOUR_MS);
  });

  it("8:59 前一分钟指向当天 9:00", () => {
    expect(msUntilTeenLockBoundary(beijingAt(8, 59), SAME_DAY)).toBe(60 * 1000);
  });

  it("23:59 指向次日 9:00（跨零点）", () => {
    expect(msUntilTeenLockBoundary(beijingAt(23, 59), SAME_DAY)).toBe(
      9 * HOUR_MS + 60 * 1000,
    );
  });
});

describe("msUntilTeenLockBoundary（跨日形态 22-6）", () => {
  it("白天指向当天 22:00", () => {
    expect(msUntilTeenLockBoundary(beijingAt(12, 0), CROSS_DAY)).toBe(10 * HOUR_MS);
  });

  it("凌晨指向当天 06:00", () => {
    expect(msUntilTeenLockBoundary(beijingAt(1, 0), CROSS_DAY)).toBe(5 * HOUR_MS);
  });

  it("锁定窗口内指向次日 06:00", () => {
    expect(msUntilTeenLockBoundary(beijingAt(22, 0), CROSS_DAY)).toBe(8 * HOUR_MS);
    expect(msUntilTeenLockBoundary(beijingAt(23, 59), CROSS_DAY)).toBe(
      6 * HOUR_MS + 60 * 1000,
    );
  });

  it("恰好命中边界时指向下一个边界", () => {
    expect(msUntilTeenLockBoundary(beijingAt(6, 0), CROSS_DAY)).toBe(16 * HOUR_MS);
  });
});

describe("msUntilTeenLockBoundary（全天形态）", () => {
  it("无边界，返回 Infinity（调用方据此不设定时器）", () => {
    expect(msUntilTeenLockBoundary(beijingAt(12, 0), ALWAYS)).toBe(
      Number.POSITIVE_INFINITY,
    );
  });
});

describe("teenLockWindowLabel", () => {
  it("本日形态不带次日字样", () => {
    expect(teenLockWindowLabel(SAME_DAY)).toBe("9:00-18:00");
  });

  it("跨日形态带次日字样", () => {
    expect(teenLockWindowLabel(CROSS_DAY)).toBe("22:00-次日6:00");
  });

  it("全天形态不展示时段", () => {
    expect(teenLockWindowLabel(ALWAYS)).toBe("全天");
  });
});
