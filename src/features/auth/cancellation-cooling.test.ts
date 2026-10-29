import { describe, expect, it } from "vitest";

import {
  buildCoolingRecord,
  formatCoolEndTime,
  isCoolingActive,
} from "./cancellation-cooling";

describe("buildCoolingRecord", () => {
  it("截止时间 = 提交时间 + 冷静期天数", () => {
    const startedAt = new Date("2025-01-01T10:00:00").getTime();
    const record = buildCoolingRecord("138****0000", startedAt, 15);
    expect(record.coolEndTime).toBe(startedAt + 15 * 24 * 60 * 60 * 1000);
  });

  it("天数非法时按 1 天兜底", () => {
    const startedAt = new Date("2025-01-01T10:00:00").getTime();
    const record = buildCoolingRecord("138****0000", startedAt, 0);
    expect(record.coolEndTime).toBe(startedAt + 24 * 60 * 60 * 1000);
  });
});

describe("formatCoolEndTime", () => {
  it("按设计稿格式输出（月日时不补零，分钟补零）", () => {
    const timestamp = new Date("2025-01-21T19:50:00").getTime();
    expect(formatCoolEndTime(timestamp)).toBe("2025年1月21日19时50分");
  });

  it("分钟个位补零", () => {
    const timestamp = new Date("2025-11-05T08:07:00").getTime();
    expect(formatCoolEndTime(timestamp)).toBe("2025年11月5日8时07分");
  });
});

describe("isCoolingActive", () => {
  const record = {
    phone: "138****0000",
    coolEndTime: new Date("2025-01-21T19:50:00").getTime(),
    coolingDays: 15,
  };

  it("未到期时处于冷静期", () => {
    expect(isCoolingActive(record, new Date("2025-01-10T00:00:00").getTime())).toBe(true);
  });

  it("到期后不再处于冷静期", () => {
    expect(isCoolingActive(record, new Date("2025-01-22T00:00:00").getTime())).toBe(false);
  });

  it("无记录时不处于冷静期", () => {
    expect(isCoolingActive(null)).toBe(false);
  });
});
