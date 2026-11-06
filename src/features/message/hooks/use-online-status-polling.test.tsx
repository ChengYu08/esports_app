import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useOnlineStatusPolling } from "./use-online-status-polling";

const { refreshMock, appStateMock } = vi.hoisted(() => ({
  refreshMock: vi.fn(async () => true),
  appStateMock: {
    currentState: "active" as string,
    handlers: [] as ((state: string) => void)[],
  },
}));

vi.mock("react-native", () => ({
  AppState: {
    get currentState() {
      return appStateMock.currentState;
    },
    addEventListener: vi.fn((_event: string, handler: (state: string) => void) => {
      appStateMock.handlers.push(handler);
      return {
        remove: vi.fn(() => {
          appStateMock.handlers = appStateMock.handlers.filter((item) => item !== handler);
        }),
      };
    }),
  },
}));

vi.mock("../message-store", () => ({
  useMessageStore: (selector: (state: { refreshOnlineStatuses: typeof refreshMock }) => unknown) =>
    selector({ refreshOnlineStatuses: refreshMock }),
}));

// node 测试环境需要显式声明，否则 react-test-renderer 的 act() 会输出告警
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function Harness({ enabled, token }: { enabled: boolean; token: string | null }) {
  useOnlineStatusPolling(enabled, token);
  return null;
}

function renderHarness(enabled: boolean, token: string | null) {
  let renderer: ReactTestRenderer | undefined;
  act(() => {
    renderer = create(<Harness enabled={enabled} token={token} />);
  });
  return renderer as ReactTestRenderer;
}

function emitAppState(state: string) {
  act(() => {
    appStateMock.handlers.forEach((handler) => handler(state));
  });
}

describe("useOnlineStatusPolling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    refreshMock.mockReset();
    refreshMock.mockResolvedValue(true);
    appStateMock.currentState = "active";
    appStateMock.handlers = [];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("polls every 5 seconds while enabled and foregrounded", async () => {
    const renderer = renderHarness(true, "token-a");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(refreshMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(refreshMock).toHaveBeenCalledTimes(2);

    act(() => {
      renderer.unmount();
    });
  });

  it("does not poll when disabled", async () => {
    const renderer = renderHarness(false, "token-a");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });

    expect(refreshMock).not.toHaveBeenCalled();
    act(() => {
      renderer.unmount();
    });
  });

  it("pauses in background and resumes on foreground", async () => {
    const renderer = renderHarness(true, "token-a");
    emitAppState("background");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    expect(refreshMock).not.toHaveBeenCalled();

    emitAppState("active");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(refreshMock).toHaveBeenCalledTimes(1);

    act(() => {
      renderer.unmount();
    });
  });

  it("waits for the previous request before scheduling the next tick", async () => {
    let resolveRequest: ((value: boolean) => void) | undefined;
    refreshMock.mockImplementationOnce(
      () => new Promise<boolean>((resolve) => {
        resolveRequest = resolve;
      }),
    );
    const renderer = renderHarness(true, "token-a");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(refreshMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });
    expect(refreshMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveRequest?.(true);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(refreshMock).toHaveBeenCalledTimes(2);

    act(() => {
      renderer.unmount();
    });
  });

  it("backs off to 30 seconds after consecutive failures", async () => {
    refreshMock.mockResolvedValue(false);
    const renderer = renderHarness(true, "token-a");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(refreshMock).toHaveBeenCalledTimes(1);

    // 第 1 次失败后间隔 10s
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(refreshMock).toHaveBeenCalledTimes(2);

    // 第 2 次失败后间隔 20s
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    expect(refreshMock).toHaveBeenCalledTimes(3);

    // 第 3 次失败后封顶 30s
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(refreshMock).toHaveBeenCalledTimes(4);

    act(() => {
      renderer.unmount();
    });
  });
});
