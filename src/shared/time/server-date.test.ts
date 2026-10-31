import { describe, expect, it } from "vitest";

import { formatServerDateTime, parseServerDateTime } from "./server-date";

describe("parseServerDateTime", () => {
  it("无时区时间按北京时区（UTC+8）换算为 epoch", () => {
    // 2026-10-20 12:00:00 北京时间 = 04:00:00 UTC
    expect(parseServerDateTime("2026-10-20 12:00:00")).toBe(
      Date.UTC(2026, 9, 20, 4, 0, 0),
    );
  });

  it("空格与 T 分隔解析结果一致", () => {
    expect(parseServerDateTime("2026-10-20 12:00:00")).toBe(
      parseServerDateTime("2026-10-20T12:00:00"),
    );
  });

  it("秒可省略", () => {
    expect(parseServerDateTime("2026-10-20T12:00")).toBe(
      Date.UTC(2026, 9, 20, 4, 0, 0),
    );
  });

  it("带时区后缀的时间按其自身时区解析", () => {
    expect(parseServerDateTime("2026-10-20T12:00:00+08:00")).toBe(
      Date.UTC(2026, 9, 20, 4, 0, 0),
    );
  });

  it("容忍首尾空白", () => {
    expect(parseServerDateTime("  2026-10-20 12:00:00  ")).toBe(
      parseServerDateTime("2026-10-20 12:00:00"),
    );
  });

  it.each([undefined, null, "", "   ", "abc", "2026-13-45 99:99:99", "2026-02-30 12:00:00"])(
    "非法输入 %j 返回 NaN",
    (input) => {
      expect(parseServerDateTime(input as string | null | undefined)).toBeNaN();
    },
  );
});

describe("formatServerDateTime", () => {
  it("epoch 按北京时区格式化为 yyyy-MM-dd HH:mm:ss", () => {
    const epoch = parseServerDateTime("2026-10-20 12:30:05");
    expect(formatServerDateTime(epoch)).toBe("2026-10-20 12:30:05");
  });

  it("与 parse 互逆（跨日边界）", () => {
    const epoch = parseServerDateTime("2026-10-21 00:00:00");
    expect(formatServerDateTime(epoch)).toBe("2026-10-21 00:00:00");
  });

  it.each([Number.NaN, Infinity, -Infinity])("非法 epoch %j 返回空串", (epoch) => {
    expect(formatServerDateTime(epoch)).toBe("");
  });
});
