import type { ElementType } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TeenModeStatus } from "@/features/mine/api/teen-mode.contract";
import { completeClientLogin } from "@/features/auth/client-auth-flow";
import { clientAuthApi } from "@/features/auth/client-auth.api";
import { publishTeenModeStatus } from "@/features/mine/teen-mode-store";
import { TeenModeGate } from "./TeenModeGate";

const { apiMock, storageMock, authState, appStateMock } = vi.hoisted(() => ({
  apiMock: { status: vi.fn(), fetchTeenModeConfig: vi.fn() },
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
  fetchTeenModeConfig: apiMock.fetchTeenModeConfig,
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
  vi.restoreAllMocks();
});

function lockedScreenCount() {
  return renderer?.root.findAllByType(LockedScreenHost).length;
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

    const enabled: TeenModeStatus = {
      enabled: true,
      passwordSet: true,
      remainingAttempts: 10,
      serverTime: Date.parse("2026-11-03T18:00:00+08:00"),
    };
    await act(async () => publishTeenModeStatus(enabled, "token-a"));
    expect(lockedScreenCount()).toBe(1);

    await act(async () => resolveStatus({
      ...enabled,
      enabled: false,
      serverTime: Date.parse("2026-11-03T18:01:00+08:00"),
    }));
    expect(lockedScreenCount()).toBe(1);

    await act(async () => publishTeenModeStatus(
      { ...enabled, enabled: false },
      "token-a",
    ));
    expect(lockedScreenCount()).toBe(0);

    await act(async () => publishTeenModeStatus(enabled, "token-b"));
    expect(lockedScreenCount()).toBe(0);
  });

  it("回前台后旧校准立即失效，刷新失败时已开启账号保持锁定", async () => {
    const enabled: TeenModeStatus = {
      enabled: true,
      passwordSet: true,
      remainingAttempts: 10,
      // 23:30 在服务端配置窗口 9:00-23:00 之外
      serverTime: Date.parse("2026-11-03T23:30:00+08:00"),
    };
    apiMock.status.mockResolvedValue(enabled);
    await act(async () => {
      renderer = create(<TeenModeGate />);
    });
    expect(lockedScreenCount()).toBe(0);

    apiMock.status.mockRejectedValue(new Error("离线"));
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
    await act(async () => resolvers[0]({
      enabled: true,
      passwordSet: true,
      remainingAttempts: 10,
      serverTime: Date.parse("2026-11-03T23:31:00+08:00"),
    }));

    expect(apiMock.status).toHaveBeenCalledTimes(2);
    expect(lockedScreenCount()).toBe(1);
  });

  it("用户ID未知时不同 token 的状态发布不能解除当前账号锁定", async () => {
    authState.user.id = null;
    apiMock.status.mockImplementation(() => new Promise<TeenModeStatus>(() => {}));
    await act(async () => {
      renderer = create(<TeenModeGate />);
    });
    expect(lockedScreenCount()).toBe(1);

    const disabled: TeenModeStatus = {
      enabled: false,
      passwordSet: true,
      remainingAttempts: 10,
      serverTime: Date.parse("2026-11-03T12:00:00+08:00"),
    };
    await act(async () => publishTeenModeStatus(disabled, "token-b"));
    expect(lockedScreenCount()).toBe(1);

    await act(async () => publishTeenModeStatus(disabled, "token-a"));
    expect(lockedScreenCount()).toBe(0);
  });

  it("首次取得服务端时间后立即按下一锁定边界重排定时器", async () => {
    vi.spyOn(performance, "now").mockReturnValue(1_000);
    const timeoutSpy = vi.spyOn(globalThis, "setTimeout");
    apiMock.status.mockResolvedValue({
      enabled: true,
      passwordSet: true,
      remainingAttempts: 10,
      // 22:59:30 距服务端配置窗口 9:00-23:00 的下一边界 23:00 还有 30 秒
      serverTime: Date.parse("2026-11-03T22:59:30+08:00"),
    } satisfies TeenModeStatus);

    await act(async () => {
      renderer = create(<TeenModeGate />);
    });

    expect(timeoutSpy).toHaveBeenCalledWith(expect.any(Function), 30_000);
  });

  it("全天形态（mode=always）不产生边界定时器", async () => {
    vi.spyOn(performance, "now").mockReturnValue(1_000);
    const timeoutSpy = vi.spyOn(globalThis, "setTimeout");
    apiMock.fetchTeenModeConfig.mockResolvedValue({
      lockEnabled: true,
      mode: "always",
    });
    apiMock.status.mockResolvedValue({
      enabled: true,
      passwordSet: true,
      remainingAttempts: 10,
      serverTime: Date.parse("2026-11-03T12:00:00+08:00"),
    } satisfies TeenModeStatus);

    await act(async () => {
      renderer = create(<TeenModeGate />);
    });

    // 全天无边界：任何以有限毫秒 delay 注册的定时器都是 setTimeout(Infinity) 风暴的回归信号
    const finiteDelays = timeoutSpy.mock.calls
      .map((call) => call[1])
      .filter((delay) => typeof delay === "number" && Number.isFinite(delay));
    expect(finiteDelays).toEqual([]);
  });

  it("新装登录当次启动：走真实 completeClientLogin 登录后未开启且无弹窗记录时立即弹介绍弹窗", async () => {
    authState.accessToken = null as unknown as string;
    authState.user.id = null;
    storageMock.get.mockResolvedValue(null);
    apiMock.status.mockResolvedValue({
      enabled: false,
      passwordSet: false,
      remainingAttempts: 5,
      serverTime: Date.parse("2026-11-03T12:00:00+08:00"),
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

  it("服务端配置到达后按配置时段重判：配置外解除锁定", async () => {
    let resolveConfig!: (config: {
      lockEnabled: boolean;
      mode?: "same-day" | "cross-day";
      lockStartHour?: number;
      lockEndHour?: number;
    }) => void;
    apiMock.fetchTeenModeConfig.mockImplementation(
      () => new Promise((resolve) => {
        resolveConfig = resolve;
      }),
    );
    // 23:30 在服务端配置窗口 9:00-23:00 之外；配置未到达前 fail-closed 先锁定
    apiMock.status.mockResolvedValue({
      enabled: true,
      passwordSet: true,
      remainingAttempts: 10,
      serverTime: Date.parse("2026-11-03T23:30:00+08:00"),
    } satisfies TeenModeStatus);

    await act(async () => {
      renderer = create(<TeenModeGate />);
    });
    expect(lockedScreenCount()).toBe(1);

    await act(async () => {
      resolveConfig({
        lockEnabled: true,
        mode: "same-day",
        lockStartHour: 9,
        lockEndHour: 23,
      });
    });
    expect(lockedScreenCount()).toBe(0);
  });

  it("服务端明确返回未配置时段（lockEnabled=false）时解除锁定", async () => {
    apiMock.fetchTeenModeConfig.mockResolvedValue({ lockEnabled: false });
    apiMock.status.mockResolvedValue({
      enabled: true,
      passwordSet: true,
      remainingAttempts: 10,
      // 任意时刻都不应锁定
      serverTime: Date.parse("2026-11-03T12:00:00+08:00"),
    } satisfies TeenModeStatus);

    await act(async () => {
      renderer = create(<TeenModeGate />);
    });
    expect(lockedScreenCount()).toBe(0);
  });

  it("配置请求失败时已开启账号保持 fail-closed", async () => {
    apiMock.fetchTeenModeConfig.mockRejectedValue(new Error("网络异常"));
    apiMock.status.mockResolvedValue({
      enabled: true,
      passwordSet: true,
      remainingAttempts: 10,
      serverTime: Date.parse("2026-11-03T12:00:00+08:00"),
    } satisfies TeenModeStatus);

    await act(async () => {
      renderer = create(<TeenModeGate />);
    });
    expect(lockedScreenCount()).toBe(1);
  });
});
