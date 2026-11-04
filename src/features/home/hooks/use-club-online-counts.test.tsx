import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Club } from "@/features/home/api/home.types";
import { useClubOnlineCounts } from "./use-club-online-counts";

const { apiMock, focusState } = vi.hoisted(() => ({
  apiMock: { fetchClubOnlineCount: vi.fn() },
  focusState: { focused: true },
}));

vi.mock("expo-router", () => ({
  useIsFocused: () => focusState.focused,
}));
vi.mock("@/features/home/api/home.api", () => apiMock);

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let renderer: ReactTestRenderer | undefined;
let queryClient: QueryClient | undefined;

function createClub(id: string): Club {
  return {
    id,
    name: `俱乐部${id}`,
    description: "简介",
    onlineCount: 0,
    memberCount: 0,
    clubCode: id,
    gameIds: [14],
  };
}

function Harness({ clubs }: { clubs: Club[] }): ReactElement | null {
  useClubOnlineCounts(clubs);
  return null;
}

function tree(clubs: Club[]) {
  return (
    <QueryClientProvider client={queryClient!}>
      <Harness clubs={clubs} />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  focusState.focused = true;
  queryClient = new QueryClient();
});

afterEach(async () => {
  if (renderer) {
    await act(async () => renderer?.unmount());
  }
  renderer = undefined;
  queryClient?.clear();
  queryClient = undefined;
  vi.useRealTimers();
});

describe("useClubOnlineCounts 请求生命周期", () => {
  it("快速切换可见俱乐部时只查询最后停留的一组", async () => {
    apiMock.fetchClubOnlineCount.mockResolvedValue(2);
    const first = [createClub("1")];
    const last = [createClub("2")];

    await act(async () => {
      renderer = create(tree(first));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    await act(async () => {
      renderer?.update(tree(last));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(apiMock.fetchClubOnlineCount).toHaveBeenCalledTimes(1);
    expect(apiMock.fetchClubOnlineCount).toHaveBeenCalledWith("2", [14], expect.anything());
  });

  it("失焦后停止旧批次，不再请求后续俱乐部", async () => {
    const pending: ((count: number) => void)[] = [];
    apiMock.fetchClubOnlineCount.mockImplementation(
      () =>
        new Promise<number>((resolve) => {
          pending.push(resolve);
        }),
    );
    const clubs = Array.from({ length: 6 }, (_, index) =>
      createClub(String(index + 1)),
    );

    await act(async () => {
      renderer = create(tree(clubs));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(apiMock.fetchClubOnlineCount).toHaveBeenCalledTimes(4);

    focusState.focused = false;
    await act(async () => renderer?.update(tree(clubs)));
    await act(async () => {
      pending.splice(0).forEach((resolve) => resolve(1));
      await vi.runAllTimersAsync();
    });

    expect(apiMock.fetchClubOnlineCount).toHaveBeenCalledTimes(4);
  });

  it("短时间失焦再聚焦复用新鲜缓存，不重复请求", async () => {
    apiMock.fetchClubOnlineCount.mockResolvedValue(2);
    const clubs = [createClub("1")];

    await act(async () => {
      renderer = create(tree(clubs));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(apiMock.fetchClubOnlineCount).toHaveBeenCalledTimes(1);

    focusState.focused = false;
    await act(async () => renderer?.update(tree(clubs)));
    focusState.focused = true;
    await act(async () => renderer?.update(tree(clubs)));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(apiMock.fetchClubOnlineCount).toHaveBeenCalledTimes(1);
  });
});
