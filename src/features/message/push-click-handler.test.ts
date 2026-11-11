import { beforeEach, describe, expect, it, vi } from "vitest";

const routerPush = vi.fn();
const toolkitMock = {
  getPendingPushClick: vi.fn(),
  clearPendingPushClick: vi.fn(async () => undefined),
};

const platformMock = {
  OS: "ios",
  select: <T,>(options: { ios?: T; android?: T; default?: T }) =>
    options.ios ?? options.default,
};

vi.mock("react-native", () => ({
  Platform: platformMock,
}));
vi.mock("expo-router", () => ({
  router: { push: routerPush },
}));
vi.mock("../../../modules/expo-app-toolkit", () => ({
  default: toolkitMock,
}));

const { handlePendingPushClick } = await import("./push-click-handler");

describe("handlePendingPushClick", () => {
  beforeEach(() => {
    routerPush.mockClear();
    toolkitMock.getPendingPushClick.mockReset();
    toolkitMock.clearPendingPushClick.mockClear();
    toolkitMock.clearPendingPushClick.mockResolvedValue(undefined);
  });

  it("iOS：读取对象后跳转对应聊天并清除暂存", async () => {
    toolkitMock.getPendingPushClick.mockResolvedValue({
      targetId: "u123",
      conversationType: "private",
    });

    await handlePendingPushClick();

    expect(routerPush).toHaveBeenCalledWith({
      pathname: "/chat/[id]",
      params: { id: "u123", title: "" },
    });
    expect(toolkitMock.clearPendingPushClick).toHaveBeenCalledTimes(1);
  });

  it("iOS：系统会话 ID 归一化为 rc_p_ 前缀并带标题", async () => {
    toolkitMock.getPendingPushClick.mockResolvedValue({
      targetId: "50000002",
      conversationType: "private",
    });

    await handlePendingPushClick();

    expect(routerPush).toHaveBeenCalledWith({
      pathname: "/chat/[id]",
      params: { id: "rc_p_50000002", title: "订单助手" },
    });
  });

  it("iOS：无暂存数据时不跳转也不清除", async () => {
    toolkitMock.getPendingPushClick.mockResolvedValue(null);

    await handlePendingPushClick();

    expect(routerPush).not.toHaveBeenCalled();
    expect(toolkitMock.clearPendingPushClick).not.toHaveBeenCalled();
  });

  it("iOS：缺 targetId 时回落到消息 Tab", async () => {
    toolkitMock.getPendingPushClick.mockResolvedValue({
      targetId: "",
      conversationType: "private",
    });

    await handlePendingPushClick();

    expect(routerPush).toHaveBeenCalledWith("/(tabs)/message");
  });

  it("Android：返回 JSON 字符串时解析后跳转", async () => {
    platformMock.OS = "android";
    toolkitMock.getPendingPushClick.mockResolvedValue(
      JSON.stringify({ targetId: "u456", conversationType: "private" }),
    );

    try {
      await handlePendingPushClick();

      expect(routerPush).toHaveBeenCalledWith({
        pathname: "/chat/[id]",
        params: { id: "u456", title: "" },
      });
      expect(toolkitMock.clearPendingPushClick).toHaveBeenCalledTimes(1);
    } finally {
      platformMock.OS = "ios";
    }
  });

  it("原生模块缺失（Expo Go 等）时静默不跳转", async () => {
    toolkitMock.getPendingPushClick.mockRejectedValue(
      new Error("module missing"),
    );

    await expect(handlePendingPushClick()).resolves.toBeUndefined();

    expect(routerPush).not.toHaveBeenCalled();
  });
});
