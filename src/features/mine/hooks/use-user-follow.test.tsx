import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useUserFollowPage } from "./use-user-follow";

const { apiMock, authState, focusState } = vi.hoisted(() => ({
  apiMock: {
    fetchUserFollowCount: vi.fn(),
    fetchUserFollowPage: vi.fn(),
    fetchUserFollowState: vi.fn(),
    followUser: vi.fn(),
    unfollowUser: vi.fn(),
  },
  authState: { accessToken: "token", user: { id: "viewer" } },
  focusState: { focused: true },
}));

vi.mock("expo-router", () => ({
  useIsFocused: () => focusState.focused,
}));
vi.mock("@esports/auth", () => ({
  useAuthStore: (selector: (state: typeof authState) => unknown) =>
    selector(authState),
}));
vi.mock("@/features/mine/api/user-follow.api", () => apiMock);

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function Harness({ userId }: { userId?: string }): ReactElement | null {
  useUserFollowPage(userId, "fans");
  return null;
}

function tree(userId?: string) {
  return (
    <QueryClientProvider client={queryClient!}>
      <Harness userId={userId} />
    </QueryClientProvider>
  );
}

function page(hasMore = false) {
  return { items: [], page: 1, hasMore, total: 0 };
}

function flush() {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}

let renderer: ReactTestRenderer | undefined;
let queryClient: QueryClient | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  focusState.focused = true;
  apiMock.fetchUserFollowPage.mockResolvedValue(page());
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
});

afterEach(async () => {
  if (renderer) {
    await act(async () => {
      renderer?.unmount();
    });
  }
  renderer = undefined;
  queryClient?.clear();
  queryClient = undefined;
});

describe("useUserFollowPage 焦点门控", () => {
  it("失焦（藏在路由堆栈下方）时失效 user-follow-page 不应触发后台重拉", async () => {
    await act(async () => {
      renderer = create(tree("user-1"));
    });
    await act(async () => {
      await flush();
    });
    expect(apiMock.fetchUserFollowPage).toHaveBeenCalledTimes(1);

    focusState.focused = false;
    await act(async () => {
      renderer?.update(tree("user-1"));
    });
    await act(async () => {
      await queryClient!.invalidateQueries({
        queryKey: ["user-follow-page"],
      });
      await flush();
    });

    expect(apiMock.fetchUserFollowPage).toHaveBeenCalledTimes(1);
  });

  it("恢复焦点后按失效标记重新拉取列表", async () => {
    await act(async () => {
      renderer = create(tree("user-1"));
    });
    await act(async () => {
      await flush();
    });
    focusState.focused = false;
    await act(async () => {
      renderer?.update(tree("user-1"));
    });
    await act(async () => {
      await queryClient!.invalidateQueries({
        queryKey: ["user-follow-page"],
      });
      await flush();
    });

    focusState.focused = true;
    await act(async () => {
      renderer?.update(tree("user-1"));
    });
    await act(async () => {
      await flush();
    });

    expect(apiMock.fetchUserFollowPage).toHaveBeenCalledTimes(2);
  });

  it("失焦状态下挂载不发起首次拉取，聚焦后才拉取", async () => {
    focusState.focused = false;
    await act(async () => {
      renderer = create(tree("user-1"));
    });
    await act(async () => {
      await flush();
    });
    expect(apiMock.fetchUserFollowPage).not.toHaveBeenCalled();

    focusState.focused = true;
    await act(async () => {
      renderer?.update(tree("user-1"));
    });
    await act(async () => {
      await flush();
    });
    expect(apiMock.fetchUserFollowPage).toHaveBeenCalledTimes(1);
  });
});
