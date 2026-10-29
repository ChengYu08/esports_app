import { describe, expect, it } from "vitest";

import {
  shouldShowTeenPopup,
  todayString,
} from "./teen-popup";

describe("todayString", () => {
  it("按本地时区格式化为 YYYY-MM-DD", () => {
    expect(todayString(new Date(2026, 9, 29, 9, 30))).toBe("2026-10-29");
    expect(todayString(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });
});

describe("shouldShowTeenPopup", () => {
  it("勾选了不再弹（dontAsk）时恒为 false", () => {
    expect(
      shouldShowTeenPopup({ dontAsk: true, lastDismissedDate: "2026-10-29" }, "2026-10-29"),
    ).toBe(false);
    expect(shouldShowTeenPopup({ dontAsk: true }, "2026-10-29")).toBe(false);
  });

  it("当天已弹过（无论是否勾选）不再弹", () => {
    expect(
      shouldShowTeenPopup({ dontAsk: false, lastDismissedDate: "2026-10-29" }, "2026-10-29"),
    ).toBe(false);
  });

  it("昨天弹过，今天（每日首次）弹", () => {
    expect(
      shouldShowTeenPopup({ dontAsk: false, lastDismissedDate: "2026-10-28" }, "2026-10-29"),
    ).toBe(true);
  });

  it("没有任何记录时弹", () => {
    expect(shouldShowTeenPopup({ dontAsk: false }, "2026-10-29")).toBe(true);
  });
});
