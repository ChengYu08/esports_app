import type { ElementType } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import { CircleScreen } from "./CircleScreen";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const blockedUsers = vi.hoisted(() => new Set<string>());
const loadedTabs = vi.hoisted(() => ({ hot: false, follow: false }));
const finishLoading = vi.hoisted(() => ({ hot: null as (() => void) | null, follow: null as (() => void) | null }));
const ViewHost = "View" as unknown as ElementType;
const FlashListHost = "FlashList" as unknown as ElementType;
const PressableHost = "Pressable" as unknown as ElementType;

vi.mock("react-native", () => ({
  AppState: { currentState: "active", addEventListener: () => ({ remove() {} }) },
  Pressable: "Pressable",
  StyleSheet: { create: (styles: unknown) => styles },
  Text: "Text",
  View: "View",
}));
vi.mock("@shopify/flash-list", () => ({ FlashList: "FlashList" }));
vi.mock("@tanstack/react-query", () => ({
  infiniteQueryOptions: (options: unknown) => options,
  useQueryClient: () => ({
    getQueryData: (queryKey: string[]) => {
      const kind = queryKey[1] as "latest" | "hot" | "follow";
      return kind === "latest" || loadedTabs[kind] ? { pages: [] } : undefined;
    },
    fetchInfiniteQuery: ({ queryKey }: { queryKey: string[] }) => {
      const kind = queryKey[1] as "hot" | "follow";
      return new Promise((resolve) => {
        finishLoading[kind] = () => {
          loadedTabs[kind] = true;
          resolve({ pages: [{ list: [{ id: `${kind}-video`, authorId: "author" }] }] });
        };
      });
    },
  }),
  useInfiniteQuery: ({ queryKey, placeholderData }: { queryKey: string[]; placeholderData?: unknown }) => {
    const kind = queryKey[1] as "latest" | "hot" | "follow";
    const loaded = kind === "latest" || loadedTabs[kind];
    const shownKind = loaded ? kind : placeholderData ? "latest" : null;
    return {
      data: shownKind
        ? { pages: [{ list: [{ id: `${shownKind}-video`, authorId: "author" }] }] }
        : undefined,
      isPlaceholderData: !loaded && Boolean(placeholderData),
      isLoading: !loaded && !placeholderData,
      isError: false,
      isSuccess: loaded || Boolean(placeholderData),
      isRefetching: false,
      isFetchingNextPage: false,
      hasNextPage: false,
    };
  },
}));
vi.mock("@esports/auth", () => ({
  useAuthStore: (selector: (state: { accessToken: string; isCompanion: boolean }) => unknown) =>
    selector({ accessToken: "token", isCompanion: false }),
}));
vi.mock("@fluentui/react-native-icons", () => ({
  Camera24Regular: () => null,
  Search24Regular: () => null,
}));
vi.mock("expo-linear-gradient", () => ({ LinearGradient: "LinearGradient" }));
vi.mock("expo-status-bar", () => ({ StatusBar: () => null }));
vi.mock("expo-router", () => ({ router: { push: vi.fn() } }));
vi.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0 }) }));
vi.mock("react-native-gesture-handler", () => {
  const gesture = {
    enabled() { return this; },
    maxPointers() { return this; },
    activeOffsetX() { return this; },
    failOffsetY() { return this; },
    runOnJS() { return this; },
    onEnd() { return this; },
  };
  return { Gesture: { Pan: () => gesture }, GestureDetector: "GestureDetector" };
});
vi.mock("@/features/circle/circle-player-pool", () => ({
  CIRCLE_HOME_FEED_ID: "circle-home",
  circlePlayerPool: { activateFeed: vi.fn(), conditionalRelease: vi.fn() },
}));
vi.mock("@/features/circle/use-circle-blocked-users", () => ({
  useCircleBlockedUserIds: () => blockedUsers,
}));
vi.mock("@/features/voice-room/voice-room-session", () => ({
  useVoiceRoomSessionStore: (selector: (state: { activeRoom: null; joiningRoom: null }) => unknown) =>
    selector({ activeRoom: null, joiningRoom: null }),
}));
vi.mock("@/features/circle/components/CircleVideoCard", () => ({ CircleVideoCard: () => null }));
vi.mock("@/features/circle/components/CircleFeedSkeleton", () => ({ CircleFeedSkeleton: () => null }));
vi.mock("@/shared/ui/AsyncStates", () => ({ EmptyState: () => null }));
vi.mock("@/shared/navigation/require-login", () => ({ requireLogin: () => true }));
vi.mock("@/features/circle/circle.api", () => ({ fetchCircleFeedPage: vi.fn() }));
vi.mock("@/shared/theme/typography", () => ({ SYSTEM_FONT: "System" }));

describe("CircleScreen tab transition", () => {
  it("切换最新、最热、关注时只展示当前 Tab 的视频", async () => {
    loadedTabs.hot = false;
    loadedTabs.follow = false;
    finishLoading.hot = null;
    finishLoading.follow = null;
    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(<CircleScreen active bottomInset={0} />);
    });
    await act(async () => {
      renderer?.root.findAllByType(ViewHost)[0].props.onLayout({
        nativeEvent: { layout: { height: 800 } },
      });
    });

    expect(renderer?.root.findByType(FlashListHost).props.data).toEqual([
      { id: "latest-video", authorId: "author" },
    ]);
    const latestList = renderer?.root.findByType(FlashListHost);

    const tabs = () => renderer?.root.findAllByType(PressableHost)
      .filter((item) => item.props.accessibilityRole === "tab");
    await act(async () => {
      tabs()?.[1].props.onPress();
    });
    expect(renderer?.root.findByType(FlashListHost).props.data).toEqual([
      { id: "latest-video", authorId: "author" },
    ]);
    expect(tabs()?.[0].props.accessibilityState.selected).toBe(true);

    await act(async () => finishLoading.hot?.());
    expect(renderer?.root.findByType(FlashListHost).props.data).toEqual([
      { id: "hot-video", authorId: "author" },
    ]);
    expect(renderer?.root.findByType(FlashListHost)).not.toBe(latestList);
    expect(tabs()?.[1].props.accessibilityState.selected).toBe(true);

    await act(async () => tabs()?.[2].props.onPress());
    expect(renderer?.root.findByType(FlashListHost).props.data).toEqual([
      { id: "hot-video", authorId: "author" },
    ]);
    await act(async () => finishLoading.follow?.());
    expect(renderer?.root.findByType(FlashListHost).props.data).toEqual([
      { id: "follow-video", authorId: "author" },
    ]);

    await act(async () => tabs()?.[0].props.onPress());
    expect(renderer?.root.findByType(FlashListHost).props.data).toEqual([
      { id: "latest-video", authorId: "author" },
    ]);

    await act(async () => renderer?.unmount());
  });
});
