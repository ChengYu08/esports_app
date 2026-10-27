import { beforeEach, describe, expect, it, vi } from "vitest";

import { storage } from "@/core/storage/storage";

import {
  isMessageNotificationMuted,
  isQuietHours,
  parseNotificationSettings,
  readNotificationSettings,
  saveDoNotDisturbEnabled,
} from "./notification-settings";

vi.mock("@/core/storage/storage", () => ({
  storage: { get: vi.fn(async () => null), set: vi.fn(async () => undefined) },
}));

describe("isQuietHours", () => {
  it("23:00 起、6:00 前为免打扰时段", () => {
    expect(isQuietHours(new Date(2026, 9, 27, 23, 0, 0))).toBe(true);
    expect(isQuietHours(new Date(2026, 9, 27, 23, 59, 59))).toBe(true);
    expect(isQuietHours(new Date(2026, 9, 28, 0, 0, 0))).toBe(true);
    expect(isQuietHours(new Date(2026, 9, 28, 5, 59, 59))).toBe(true);
  });

  it("6:00 起到 22:59 为正常时段", () => {
    expect(isQuietHours(new Date(2026, 9, 27, 6, 0, 0))).toBe(false);
    expect(isQuietHours(new Date(2026, 9, 27, 12, 0, 0))).toBe(false);
    expect(isQuietHours(new Date(2026, 9, 27, 22, 59, 59))).toBe(false);
  });
});

describe("parseNotificationSettings", () => {
  it("空值与非法数据回退到默认设置", () => {
    expect(parseNotificationSettings(null)).toEqual({
      doNotDisturbEnabled: false,
    });
    expect(parseNotificationSettings("not-json")).toEqual({
      doNotDisturbEnabled: false,
    });
    expect(parseNotificationSettings(JSON.stringify([1, 2]))).toEqual({
      doNotDisturbEnabled: false,
    });
  });

  it("解析免打扰开关", () => {
    expect(
      parseNotificationSettings(JSON.stringify({ doNotDisturbEnabled: true })),
    ).toEqual({ doNotDisturbEnabled: true });
    expect(
      parseNotificationSettings(JSON.stringify({ doNotDisturbEnabled: "1" })),
    ).toEqual({ doNotDisturbEnabled: false });
  });
});

describe("isMessageNotificationMuted", () => {
  beforeEach(() => {
    vi.mocked(storage.get).mockResolvedValue(null);
    vi.clearAllMocks();
  });

  it("开关关闭时任何时段都不静音", async () => {
    await saveDoNotDisturbEnabled(false);
    expect(
      isMessageNotificationMuted(new Date(2026, 9, 27, 23, 30, 0)),
    ).toBe(false);
  });

  it("开关开启时仅免打扰时段静音", async () => {
    await saveDoNotDisturbEnabled(true);
    expect(
      isMessageNotificationMuted(new Date(2026, 9, 27, 23, 30, 0)),
    ).toBe(true);
    expect(isMessageNotificationMuted(new Date(2026, 9, 28, 5, 0, 0))).toBe(
      true,
    );
    expect(
      isMessageNotificationMuted(new Date(2026, 9, 27, 12, 0, 0)),
    ).toBe(false);
  });

  it("readNotificationSettings 返回持久化的设置", async () => {
    vi.mocked(storage.get).mockResolvedValue(
      JSON.stringify({ doNotDisturbEnabled: true }),
    );
    await readNotificationSettings();
    expect(await readNotificationSettings()).toEqual({
      doNotDisturbEnabled: true,
    });
    await saveDoNotDisturbEnabled(false);
    expect(await readNotificationSettings()).toEqual({
      doNotDisturbEnabled: false,
    });
    expect(storage.set).toHaveBeenCalledWith(
      "esports.mine.notification-settings",
      JSON.stringify({ doNotDisturbEnabled: false }),
    );
  });
});
