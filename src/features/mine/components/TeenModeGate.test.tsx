import type { ElementType } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TeenModeStatus } from "@/features/mine/api/teen-mode.contract";
import { completeClientLogin } from "@/features/auth/client-auth-flow";
import { clientAuthApi } from "@/features/auth/client-auth.api";
import { publishTeenModeStatus } from "@/features/mine/teen-mode-store";
import { TeenModeGate } from "./TeenModeGate";

const { apiMock, storageMock, authState, appStateMock } = vi.hoisted(() => ({
  apiMock: { status: vi.fn() },
  storageMock: {
    get: vi.fn(),
    set: vi.fn(),
  },
  authState: {
    accessToken: "token-a",
    user: { id: "account-a" as string | null },
  },
  appStateMock: {
    activeHandler: null as ((state: string) => void) | null,
  },
}));

vi.mock("react-native", () => ({
  AppState: {
    addEventListener: vi.fn((_event: string, handler: (state: string) => void) => {
      appStateMock.activeHandler = handler;
      return { remove: vi.fn() };
    }),
  },
  StyleSheet: {
    absoluteFill: {},
    create: <T,>(styles: T) => styles,
  },
  View: "View",
}));
vi.mock("expo-router", () => ({ router: { push: vi.fn() } }));
vi.mock("@esports/auth", () => ({
  useAuthStore: (selector: (state: typeof authState) => unknown) =>
    selector(authState),
}));
vi.mock("@/core/storage/storage", () => ({ storage: storageMock }));
vi.mock("@/core/logging/logger", () => ({
  logger: { debug: vi.fn(), warn: vi.fn() },
}));
vi.mock("@/features/auth/client-auth.api", () => ({
  clientAuthApi: {
    exchangeIdToken: vi.fn(),
    fetchCurrentUser: vi.fn(),
  },
}));
vi.mock("@/features/auth/session-persistence", () => ({
  saveAuthSession: vi.fn(),
}));
vi.mock("@/features/auth/api/companion.api", () => ({
  fetchUserDetail: vi.fn(),
}));
vi.mock("@/features/mine/api/teen-mode.api", () => ({
  teenModeApi: apiMock,
}));
vi.mock("@/features/mine/screens/TeenModeScreen", () => ({
  default: "LockedTeenModeScreen",
}));
vi.mock("@/features/mine/components/TeenModePromoDialog", () => ({
  TeenModePromoDialog: "TeenModePromoDialog",
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const LockedScreenHost = "LockedTeenModeScreen" as unknown as ElementType;
let renderer: ReactTestRenderer | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  authState.accessToken = "token-a";
  authState.user.id = "account-a";
  appStateMock.activeHandler = null;
  storageMock.get.mockResolvedValue("false");
  storageMock.set.mockResolvedValue(undefined);
});

afterEach(async () => {
  if (renderer) {
    await act(async () => renderer?.unmount());
  }
  renderer = undefined;
  vi.restoreAllMocks();
});

function lockedScreenCount() {
  return renderer?.root.findAllByType(LockedScreenHost).length;
}

function statusOf(enabled: boolean, isoTime: string): TeenModeStatus {
  return {
    enabled,
    passwordSet: true,
    remainingAttempts: 10,
    serverTime: Date.parse(isoTime),
  };
}

describe("TeenModeGate 独立设置页状态同步", () => {
  it("当前账号操作使旧状态响应失效且其他账号状态互不影响", async () => {
    let resolveStatus!: (status: TeenModeStatus) => void;
    apiMock.status.mockImplementation(
      () => new Promise<TeenModeStatus>((resolve) => {
        resolveStatus = resolve;
      }),
    );
    await act(async () => {
      renderer = create(<TeenModeGate />);
    });
    expect(lockedScreenCount()).toBe(0);

    const enabled = statusOf(true, "2026-11-09T18:00:00+08:00");
    await act(async () => publishTeenModeStatus(enabled, "token-a"));
    expect(lockedScreenCount()).toBe(1);

    await act(async () => resolveStatus(statusOf(false, "2026-11-09T18:01:00+08:00")));
    expect(lockedScreenCount()).toBe(1);

    await act(async () => publishTeenModeStatus(
      statusOf(false, "2026-11-09T18:02:00+08:00"),
      "token-a",
    ));
    expect(lockedScreenCount()).toBe(0);

    await act(async () => publishTeenModeStatus(enabled, "token-b"));
    expect(lockedScreenCount()).toBe(0);
  });

  it("开启青少年模式后覆盖层立即出现，无需重启 App", async () => {
    apiMock.status.mockResolvedValue(statusOf(false, "2026-11-09T10:00:00+08:00"));
    await act(async () => {
      renderer = create(<TeenModeGate />);
    });
    expect(lockedScreenCount()).toBe(0);

    // 设置页开启成功后同步广播，覆盖层当帧出现
    await act(async () => publishTeenModeStatus(
      statusOf(true, "2026-11-09T10:01:00+08:00"),
      "token-a",
    ));
    expect(lockedScreenCount()).toBe(1);
  });

  it("存储镜像已开启时启动即锁定，回前台刷新失败也保持锁定", async () => {
    storageMock.get.mockResolvedValue("true");
    apiMock.status.mockRejectedValue(new Error("离线"));
    await act(async () => {
      renderer = create(<TeenModeGate />);
    });
    expect(lockedScreenCount()).toBe(1);

    await act(async () => appStateMock.activeHandler?.("active"));
    expect(lockedScreenCount()).toBe(1);
  });

  it("回前台使在途旧响应失效并发起新校准", async () => {
    const resolvers: ((status: TeenModeStatus) => void)[] = [];
    apiMock.status.mockImplementation(
      () => new Promise<TeenModeStatus>((resolve) => {
        resolvers.push(resolve);
      }),
    );
    storageMock.get.mockResolvedValue("true");
    await act(async () => {
      renderer = create(<TeenModeGate />);
    });
    expect(lockedScreenCount()).toBe(1);

    await act(async () => appStateMock.activeHandler?.("active"));
    // 旧请求返回 disabled：已被前台失效处理丢弃，不能解除锁定
    await act(async () => resolvers[0](statusOf(false, "2026-11-09T10:00:00+08:00")));
    expect(lockedScreenCount()).toBe(1);
    expect(apiMock.status).toHaveBeenCalledTimes(2);
  });

  it("用户ID未知时不同 token 的状态发布不能解除当前账号锁定", async () => {
    authState.user.id = null;
    apiMock.status.mockImplementation(() => new Promise<TeenModeStatus>(() => {}));
    await act(async () => {
      renderer = create(<TeenModeGate />);
    });
    expect(lockedScreenCount()).toBe(1);

    await act(async () => publishTeenModeStatus(
      statusOf(false, "2026-11-09T12:00:00+08:00"),
      "token-b",
    ));
    expect(lockedScreenCount()).toBe(1);

    await act(async () => publishTeenModeStatus(
      statusOf(false, "2026-11-09T12:00:00+08:00"),
      "token-a",
    ));
    expect(lockedScreenCount()).toBe(0);
  });

  it("新装登录当次启动：走真实 completeClientLogin 登录后未开启且无弹窗记录时立即弹介绍弹窗", async () => {
    authState.accessToken = null as unknown as string;
    authState.user.id = null;
    storageMock.get.mockResolvedValue(null);
    apiMock.status.mockResolvedValue({
      enabled: false,
      passwordSet: false,
      remainingAttempts: 5,
      serverTime: Date.parse("2026-11-09T12:00:00+08:00"),
    } satisfies TeenModeStatus);
    vi.mocked(clientAuthApi.exchangeIdToken).mockResolvedValue({
      token: "token-a",
    } as Awaited<ReturnType<typeof clientAuthApi.exchangeIdToken>>);
    vi.mocked(clientAuthApi.fetchCurrentUser).mockResolvedValue({
      id: 10001,
      nickname: "测试用户",
      headImage: "",
    } as Awaited<ReturnType<typeof clientAuthApi.fetchCurrentUser>>);

    await act(async () => {
      renderer = create(<TeenModeGate />);
    });

    await act(async () => {
      await completeClientLogin({ id_token: "id-token-x", refresh_token: "refresh-x" }, "LOGIN", (session) => {
        authState.accessToken = session.accessToken;
        authState.user.id = session.user.id;
      });
    });
    await act(async () => {
      renderer?.update(<TeenModeGate />);
    });

    const promoHost = "TeenModePromoDialog" as unknown as ElementType;
    expect(renderer?.root.findAllByType(promoHost).length).toBe(1);
  });
});
