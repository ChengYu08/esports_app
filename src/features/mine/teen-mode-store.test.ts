import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TeenModeStatus } from "./api/teen-mode.contract";
import {
  publishTeenModeStatus,
  readLastTeenEnabled,
  saveLastTeenEnabled,
  subscribeTeenModeStatus,
} from "./teen-mode-store";

const { storageMock } = vi.hoisted(() => ({
  storageMock: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

vi.mock("@/core/storage/storage", () => ({ storage: storageMock }));

describe("青少年模式开启状态镜像", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("用户ID未知时不读写无法归属账号的全局镜像", async () => {
    storageMock.get.mockResolvedValue("true");

    await expect(readLastTeenEnabled(null)).resolves.toBeNull();
    await saveLastTeenEnabled(true, null);

    expect(storageMock.get).not.toHaveBeenCalled();
    expect(storageMock.set).not.toHaveBeenCalled();
  });

  it("开启状态按用户ID隔离", async () => {
    await saveLastTeenEnabled(true, "account-a");
    expect(storageMock.set).toHaveBeenCalledWith(
      "mine:teen-enabled-mirror:account-a",
      "true",
    );

    storageMock.get.mockResolvedValue("false");
    await expect(readLastTeenEnabled("account-b")).resolves.toBe(false);
    expect(storageMock.get).toHaveBeenCalledWith(
      "mine:teen-enabled-mirror:account-b",
    );
  });

  it("独立设置页状态变更可通知门禁且退订后不再接收", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeTeenModeStatus(listener);
    const status: TeenModeStatus = {
      enabled: true,
      passwordSet: true,
      remainingAttempts: 10,
      serverTime: 1,
    };

    publishTeenModeStatus(status, "account-a");
    expect(listener).toHaveBeenCalledWith(status, "account-a");

    unsubscribe();
    publishTeenModeStatus(status, "account-a");
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
