import { describe, expect, it } from "vitest";

import { formatRelativeTime } from "./relative-time";

/** 以北京时区构造"现在"，避免用例受设备时区影响。 */
const now = Date.UTC(2026, 10, 9, 6, 0, 0); // 2026-11-09 14:00 北京时间
const beijing = (date: string) => new Date(`${date}+08:00`).getTime();

describe("formatRelativeTime", () => {
  it("一分钟内显示刚刚", () => {
    expect(formatRelativeTime("2026-11-09 13:59:30", now)).toBe("刚刚");
  });

  it("一小时内显示 N分钟前", () => {
    expect(formatRelativeTime("2026-11-09 13:40:00", now)).toBe("20分钟前");
  });

  it("当天更早显示 N小时前", () => {
    expect(formatRelativeTime("2026-11-09 11:00:00", now)).toBe("3小时前");
  });

  it("昨天显示 昨天 HH:mm", () => {
    expect(formatRelativeTime("2026-11-08 20:10:00", now)).toBe("昨天 20:10");
  });

  it("7 天内显示 N天前", () => {
    expect(formatRelativeTime("2026-11-06 20:10:00", now)).toBe("3天前");
  });

  it("超过 7 天显示日期", () => {
    expect(formatRelativeTime("2026-10-20 20:10:00", now)).toBe("2026-10-20");
  });

  it("北京时区昨天的日界不随设备时区偏移", () => {
    // 北京 2026-11-09 01:30 距 2026-11-08 23:50 超过一小时，应按北京日界算昨天
    const edgeNow = beijing("2026-11-09T01:30:00");
    expect(formatRelativeTime("2026-11-08 23:50:00", edgeNow)).toBe("昨天 23:50");
  });

  it("一小时内的跨日差仍显示分钟前", () => {
    const edgeNow = beijing("2026-11-09T00:30:00");
    expect(formatRelativeTime("2026-11-08 23:50:00", edgeNow)).toBe("40分钟前");
  });

  it("无法解析时原样返回", () => {
    expect(formatRelativeTime("昨天 20:10", now)).toBe("昨天 20:10");
  });

  it.each([undefined, null, "", "   "])("空值 %j 返回空串", (input) => {
    expect(formatRelativeTime(input as string | null | undefined, now)).toBe("");
  });
});
