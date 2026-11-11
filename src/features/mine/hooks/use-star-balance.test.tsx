import { useEffect } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useStarBalance } from "./use-star-balance";

const { fetchStarBalanceMock, focusEffect } = vi.hoisted(() => ({
  fetchStarBalanceMock: vi.fn(),
  focusEffect: {
    callback: null as null | (() => void | (() => void)),
  },
}));

vi.mock("expo-router", () => ({
  useFocusEffect: (callback: () => void | (() => void)) => {
    useEffect(() => {
      focusEffect.callback = callback;
      const cleanup = callback();
      return () => {
        if (typeof cleanup === "function") cleanup();
        focusEffect.callback = null;
      };
    }, [callback]);
  },
}));

vi.mock("@/features/mine/api/companion-order.api", () => ({
  fetchStarBalance: (...args: unknown[]) => fetchStarBalanceMock(...args),
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function Harness({
  token,
  enabled,
  initialBalance = null,
}: {
  token: string | null;
  enabled: boolean;
  initialBalance?: number | null;
}) {
  const balance = useStarBalance(token, enabled, { initialBalance });
  return <>{balance === null ? "null" : String(balance)}</>;
}

describe("useStarBalance", () => {
  let renderer: ReactTestRenderer | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    focusEffect.callback = null;
    fetchStarBalanceMock.mockResolvedValue(10);
  });

  afterEach(async () => {
    if (renderer) {
      await act(async () => {
        renderer?.unmount();
      });
    }
    renderer = undefined;
  });

  it("enabled 时在获得焦点后拉取余额", async () => {
    await act(async () => {
      renderer = create(<Harness token="tok" enabled initialBalance={null} />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchStarBalanceMock).toHaveBeenCalledWith("tok");
    expect(String(renderer!.toJSON())).toBe("10");
  });

  it("充值返回再次获得焦点时重新拉取并更新余额", async () => {
    fetchStarBalanceMock
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(200);

    await act(async () => {
      renderer = create(<Harness token="tok" enabled initialBalance={10} />);
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(String(renderer!.toJSON())).toBe("10");
    expect(fetchStarBalanceMock).toHaveBeenCalledTimes(1);

    // 模拟离开充值页后路由重新 focus：再执行一次当前 focus callback
    const focusedCallback = focusEffect.callback;
    expect(focusedCallback).toBeTruthy();

    await act(async () => {
      focusedCallback?.();
      await Promise.resolve();
    });

    expect(fetchStarBalanceMock).toHaveBeenCalledTimes(2);
    expect(String(renderer!.toJSON())).toBe("200");
  });

  it("enabled=false 时不请求余额", async () => {
    await act(async () => {
      renderer = create(
        <Harness token="tok" enabled={false} initialBalance={5} />,
      );
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchStarBalanceMock).not.toHaveBeenCalled();
    expect(String(renderer!.toJSON())).toBe("5");
  });
});
