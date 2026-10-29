import { describe, expect, it } from "vitest";

import { compareVersionNos } from "./version-compare";

describe("compareVersionNos", () => {
  it("完全相等返回 0", () => {
    expect(compareVersionNos("1.0.0", "1.0.0")).toBe(0);
  });

  it("补零对齐后相等返回 0（1.0 vs 1.0.0）", () => {
    expect(compareVersionNos("1.0", "1.0.0")).toBe(0);
    expect(compareVersionNos("1.0.0", "1.0")).toBe(0);
  });

  it("当前版本更低返回 -1", () => {
    expect(compareVersionNos("1.0.0", "0.0.1")).toBe(1);
    expect(compareVersionNos("0.0.1", "1.0.0")).toBe(-1);
  });

  it("按数字逐段比较而非字符串比较", () => {
    // 字符串比较会得到 "9.9.9" > "10.0.0"，数字比较应相反
    expect(compareVersionNos("10.0.0", "9.9.9")).toBe(1);
    expect(compareVersionNos("9.9.9", "10.0.0")).toBe(-1);
  });

  it("容忍 v 前缀", () => {
    expect(compareVersionNos("v1.0.0", "1.0.0")).toBe(0);
  });

  it("非数字段按 0 处理不抛错", () => {
    expect(() => compareVersionNos("abc", "1.0.0")).not.toThrow();
  });
});
