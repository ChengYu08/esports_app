import { describe, expect, it } from "vitest";

import { parseServerDateTime } from "./server-date";

describe("parseServerDateTime", () => {
  it("解析空格分隔的服务端时间格式", () => {
    const ms = parseServerDateTime("2026-10-20 12:00:00");
    expect(Number.isFinite(ms)).toBe(true);
    expect(ms).toBe(new Date("2026-10-20T12:00:00").getTime());
  });

  it("与 ISO 格式解析结果一致", () => {
    expect(parseServerDateTime("2026-10-20 12:00:00")).toBe(
      parseServerDateTime("2026-10-20T12:00:00"),
    );
  });

  it("容忍首尾空白", () => {
    expect(parseServerDateTime("  2026-10-20 12:00:00  ")).toBe(
      parseServerDateTime("2026-10-20 12:00:00"),
    );
  });

  it.each([undefined, null, "", "   ", "abc", "2026-13-45 99:99:99"])(
    "非法输入 %j 返回 NaN",
    (input) => {
      expect(parseServerDateTime(input as string | null | undefined)).toBeNaN();
    },
  );
});
