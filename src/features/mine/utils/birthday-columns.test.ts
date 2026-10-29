import { describe, expect, it } from "vitest";

import {
  buildBirthdayColumns,
  clampDay,
  daysInMonth,
  formatBirth,
  parseBirth,
} from "./birthday-columns";

describe("daysInMonth", () => {
  it("闰年 2 月为 29 天", () => {
    expect(daysInMonth(2024, 2)).toBe(29);
  });
  it("平年 2 月为 28 天", () => {
    expect(daysInMonth(2023, 2)).toBe(28);
  });
  it("大月 31 天、小月 30 天", () => {
    expect(daysInMonth(2026, 1)).toBe(31);
    expect(daysInMonth(2026, 4)).toBe(30);
  });
});

describe("buildBirthdayColumns", () => {
  it("年份范围为当年往前 101 年（含当年）", () => {
    const today = new Date(2026, 9, 29);
    const { years, months, currentYear } = buildBirthdayColumns(today);
    expect(currentYear).toBe(2026);
    expect(years).toHaveLength(101);
    expect(years[0]).toBe(1926);
    expect(years[years.length - 1]).toBe(2026);
    expect(months).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });
});

describe("clampDay", () => {
  it("切换到小月时钳回当月最大日", () => {
    expect(clampDay(2026, 4, 31)).toBe(30);
  });
  it("闰年 2 月钳 29、平年钳 28", () => {
    expect(clampDay(2024, 2, 31)).toBe(29);
    expect(clampDay(2023, 2, 31)).toBe(28);
  });
  it("正常日期不变", () => {
    expect(clampDay(2026, 10, 10)).toBe(10);
  });
});

describe("parseBirth / formatBirth", () => {
  it("解析 YYYY-MM-DD", () => {
    expect(parseBirth("1995-08-15", { y: 2000, m: 1, d: 1 })).toEqual({
      y: 1995,
      m: 8,
      d: 15,
    });
  });
  it("非法/空输入回退 fallback", () => {
    expect(parseBirth(undefined, { y: 2000, m: 1, d: 1 })).toEqual({
      y: 2000,
      m: 1,
      d: 1,
    });
    expect(parseBirth("abc", { y: 2000, m: 1, d: 1 })).toEqual({
      y: 2000,
      m: 1,
      d: 1,
    });
  });
  it("formatBirth 输出两位月日", () => {
    expect(formatBirth(1995, 8, 15)).toBe("1995-08-15");
    expect(formatBirth(1995, 3, 5)).toBe("1995-03-05");
  });
});
