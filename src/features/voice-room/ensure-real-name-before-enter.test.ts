import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAppConfirm } from "@/shared/ui/app-confirm";

const mocks = vi.hoisted(() => ({
  authState: {
    user: { id: "user-1", isRealName: 0 as number | undefined },
  },
  push: vi.fn(),
}));

vi.mock("@esports/auth", () => ({
  useAuthStore: { getState: () => mocks.authState },
}));

vi.mock("expo-router", () => ({
  router: { push: (...args: unknown[]) => mocks.push(...args) },
}));

const {
  ensureRealNameBeforeVoiceRoomEnter,
  promptSelfRealNameIfNeeded,
} = await import("./ensure-real-name-before-enter");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authState.user = { id: "user-1", isRealName: 0 };
  useAppConfirm.getState().settle(false);
});

describe("ensureRealNameBeforeVoiceRoomEnter", () => {
  it("已实名直接放行", async () => {
    mocks.authState.user.isRealName = 1;
    await expect(ensureRealNameBeforeVoiceRoomEnter()).resolves.toBe(true);
    expect(useAppConfirm.getState().options).toBeNull();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("未实名确认后跳转实名页并返回 false", async () => {
    const flow = ensureRealNameBeforeVoiceRoomEnter();
    await vi.waitFor(() => {
      expect(useAppConfirm.getState().options).not.toBeNull();
    });
    expect(useAppConfirm.getState().options?.message).toBe("请先完成实名认证");
    expect(useAppConfirm.getState().options?.confirmText).toBe("去实名");
    expect(useAppConfirm.getState().options?.cancelText).toBe("取消");
    useAppConfirm.getState().settle(true);
    await expect(flow).resolves.toBe(false);
    expect(mocks.push).toHaveBeenCalledWith("/real-name-verification");
  });

  it("未实名取消后不跳转并返回 false", async () => {
    const flow = ensureRealNameBeforeVoiceRoomEnter();
    await vi.waitFor(() => {
      expect(useAppConfirm.getState().options).not.toBeNull();
    });
    useAppConfirm.getState().settle(false);
    await expect(flow).resolves.toBe(false);
    expect(mocks.push).not.toHaveBeenCalled();
  });
});

describe("promptSelfRealNameIfNeeded", () => {
  it("非实名错误返回 false", async () => {
    await expect(promptSelfRealNameIfNeeded("人数已满")).resolves.toBe(false);
    expect(useAppConfirm.getState().options).toBeNull();
  });

  it("本人未实名文案弹窗并返回 true", async () => {
    const flow = promptSelfRealNameIfNeeded("未进行实名认证");
    await vi.waitFor(() => {
      expect(useAppConfirm.getState().options).not.toBeNull();
    });
    expect(useAppConfirm.getState().options?.message).toBe("请先完成实名认证");
    useAppConfirm.getState().settle(true);
    await expect(flow).resolves.toBe(true);
    expect(mocks.push).toHaveBeenCalledWith("/real-name-verification");
  });
});

