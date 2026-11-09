import { createRequire } from "node:module";
import type { ElementType } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TeenModeStatus } from "@/features/mine/api/teen-mode.contract";

const { apiMock, storeMock, authState } = vi.hoisted(() => ({
  apiMock: {
    status: vi.fn(),
    open: vi.fn(),
    close: vi.fn(),
    fetchTeenModeConfig: vi.fn(),
  },
  storeMock: {
    saveLastTeenEnabled: vi.fn(),
    publishTeenModeStatus: vi.fn(),
  },
  authState: {
    accessToken: "token-a",
    user: { id: "account-a" },
  },
}));

vi.mock("expo-image", () => ({ Image: "Image" }));
vi.mock("expo-router", () => ({ router: { back: vi.fn() } }));
vi.mock("../../../../assets/svgs/icon-back.svg", () => ({ default: 1 }));
vi.mock("../../../../assets/svgs/teen-mode-closed.svg", () => ({ default: 1 }));
vi.mock("../../../../assets/svgs/teen-mode-open.svg", () => ({ default: 1 }));
vi.mock("../../../../assets/svgs/teen-mode-star.svg", () => ({ default: 1 }));
vi.mock("@/shared/ui/app-toast", () => ({
  showToast: vi.fn(),
  toastDurations: { LONG: 3500 },
}));
vi.mock("react-native", () => ({
  Platform: {
    OS: "android",
    select: <T,>(options: { android: T }) => options.android,
  },
  Pressable: "Pressable",
  StyleSheet: { create: <T,>(styles: T) => styles },
  Text: "Text",
  TextInput: "TextInput",
  View: "View",
}));
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
vi.mock("@esports/auth", () => ({
  useAuthStore: (selector: (state: typeof authState) => unknown) =>
    selector(authState),
}));
vi.mock("@/features/mine/api/teen-mode.api", () => ({
  teenModeApi: apiMock,
  fetchTeenModeConfig: apiMock.fetchTeenModeConfig,
}));
vi.mock("@/features/mine/teen-mode-store", () => storeMock);
vi.mock("@/shared/ui/ScreenHeader", () => ({ ScreenHeader: "ScreenHeader" }));

const nodeRequire = createRequire(import.meta.url);
nodeRequire.extensions[".svg"] = (module) => {
  module.exports = 1;
};
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const { default: TeenModeScreen } = await import("./TeenModeScreen");

const TextHost = "Text" as unknown as ElementType;
const TextInputHost = "TextInput" as unknown as ElementType;
const PressableHost = "Pressable" as unknown as ElementType;

let renderer: ReactTestRenderer | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  authState.accessToken = "token-a";
  authState.user.id = "account-a";
  apiMock.fetchTeenModeConfig.mockResolvedValue({
    lockEnabled: true,
    mode: "same-day",
    lockStartHour: 9,
    lockEndHour: 23,
  });
});

afterEach(async () => {
  if (renderer) {
    await act(async () => renderer?.unmount());
  }
  renderer = undefined;
});

async function renderScreen(locked = false) {
  await act(async () => {
    renderer = create(<TeenModeScreen locked={locked} />);
  });
}

function renderedTexts() {
  return renderer?.root
    .findAllByType(TextHost)
    .map((node) => node.props.children)
    .flat();
}

describe("TeenModeScreen 状态恢复与同步", () => {
  it("锁定页状态请求失败后仍可输入密码关闭", async () => {
    apiMock.status.mockRejectedValue(new Error("网络失败"));

    await renderScreen(true);

    expect(renderedTexts()).toContain("关闭青少年模式");
    expect(renderedTexts()).toContain("确认");
  });

  it("独立设置页关闭成功后发布最新账号状态", async () => {
    const status: TeenModeStatus = {
      enabled: true,
      passwordSet: true,
      remainingAttempts: 10,
      serverTime: 1,
    };
    const closed: TeenModeStatus = {
      ...status,
      enabled: false,
      serverTime: 2,
    };
    apiMock.status.mockResolvedValue(status);
    apiMock.close.mockResolvedValue(closed);
    await renderScreen();

    expect(storeMock.publishTeenModeStatus).not.toHaveBeenCalled();
    const closeButton = renderer?.root
      .findAllByType(PressableHost)
      .find((node) => node.props.accessibilityLabel === "关闭青少年模式");
    await act(async () => closeButton?.props.onPress());
    const input = renderer?.root.findByType(TextInputHost);
    await act(async () => input?.props.onChangeText("1234"));
    const confirmButton = renderer?.root
      .findAllByType(PressableHost)
      .find((node) => node.props.accessibilityLabel === "确认");
    await act(async () => confirmButton?.props.onPress());

    expect(apiMock.close).toHaveBeenCalledWith("token-a", "1234");
    expect(storeMock.publishTeenModeStatus).toHaveBeenLastCalledWith(
      closed,
      "token-a",
    );
  });

  it("开启成功 toast 展示服务端配置的锁定时段", async () => {
    const { showToast } = await import("@/shared/ui/app-toast");
    apiMock.fetchTeenModeConfig.mockResolvedValue({
      lockEnabled: true,
      mode: "cross-day",
      lockStartHour: 22,
      lockEndHour: 6,
    });
    apiMock.status.mockResolvedValue({
      enabled: false,
      passwordSet: false,
      remainingAttempts: 10,
      serverTime: 1,
    });
    apiMock.open.mockResolvedValue({
      enabled: true,
      passwordSet: true,
      remainingAttempts: 10,
      serverTime: 2,
    });
    await renderScreen();

    const openButton = renderer?.root
      .findAllByType(PressableHost)
      .find((node) => node.props.accessibilityLabel === "开启青少年模式");
    await act(async () => openButton?.props.onPress());
    const input = renderer?.root.findByType(TextInputHost);
    await act(async () => input?.props.onChangeText("1234"));
    // setFirst 输满 4 位自动进入 setConfirm，再输一次并确认
    await act(async () => input?.props.onChangeText("1234"));
    const confirmButton = renderer?.root
      .findAllByType(PressableHost)
      .find((node) => node.props.accessibilityLabel === "确认");
    await act(async () => confirmButton?.props.onPress());

    expect(apiMock.open).toHaveBeenCalledWith("token-a", "1234", "1234");
    expect(showToast).toHaveBeenCalledWith(
      "青少年模式已开启，每日 22:00-次日6:00 期间限制核心功能",
    );
  });

  it("服务端配置全天形态时开启成功 toast 不带时段字样", async () => {
    const { showToast } = await import("@/shared/ui/app-toast");
    apiMock.fetchTeenModeConfig.mockResolvedValue({
      lockEnabled: true,
      mode: "always",
    });
    apiMock.status.mockResolvedValue({
      enabled: false,
      passwordSet: false,
      remainingAttempts: 10,
      serverTime: 1,
    });
    apiMock.open.mockResolvedValue({
      enabled: true,
      passwordSet: true,
      remainingAttempts: 10,
      serverTime: 2,
    });
    await renderScreen();

    const openButton = renderer?.root
      .findAllByType(PressableHost)
      .find((node) => node.props.accessibilityLabel === "开启青少年模式");
    await act(async () => openButton?.props.onPress());
    const input = renderer?.root.findByType(TextInputHost);
    await act(async () => input?.props.onChangeText("1234"));
    // setFirst 输满 4 位自动进入 setConfirm，再输一次并确认
    await act(async () => input?.props.onChangeText("1234"));
    const confirmButton = renderer?.root
      .findAllByType(PressableHost)
      .find((node) => node.props.accessibilityLabel === "确认");
    await act(async () => confirmButton?.props.onPress());

    expect(apiMock.open).toHaveBeenCalledWith("token-a", "1234", "1234");
    expect(showToast).toHaveBeenCalledWith("青少年模式已开启，全天限制核心功能");
  });

  it("服务端未配置锁定时段时开启成功 toast 不展示时段", async () => {
    const { showToast } = await import("@/shared/ui/app-toast");
    apiMock.fetchTeenModeConfig.mockResolvedValue({ lockEnabled: false });
    apiMock.status.mockResolvedValue({
      enabled: false,
      passwordSet: false,
      remainingAttempts: 10,
      serverTime: 1,
    });
    apiMock.open.mockResolvedValue({
      enabled: true,
      passwordSet: true,
      remainingAttempts: 10,
      serverTime: 2,
    });
    await renderScreen();

    const openButton = renderer?.root
      .findAllByType(PressableHost)
      .find((node) => node.props.accessibilityLabel === "开启青少年模式");
    await act(async () => openButton?.props.onPress());
    const input = renderer?.root.findByType(TextInputHost);
    await act(async () => input?.props.onChangeText("1234"));
    await act(async () => input?.props.onChangeText("1234"));
    const confirmButton = renderer?.root
      .findAllByType(PressableHost)
      .find((node) => node.props.accessibilityLabel === "确认");
    await act(async () => confirmButton?.props.onPress());

    expect(showToast).toHaveBeenCalledWith("青少年模式已开启");
  });
});
