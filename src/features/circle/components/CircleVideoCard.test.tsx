import type { ElementType } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import type { CircleVideoPost } from "@/features/circle/circle-data";
import { CircleVideoCard } from "./CircleVideoCard";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const coverWrites = vi.hoisted(() => [] as number[]);
const VideoPlayerHost = "CircleVideoPlayer" as unknown as ElementType;

vi.mock("react-native", () => ({
  Pressable: "Pressable",
  StyleSheet: {
    absoluteFill: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
    create: (styles: unknown) => styles,
  },
  Text: "Text",
  View: "View",
}));
vi.mock("react-native-reanimated", async () => {
  const { useRef } = await import("react");
  return {
    default: { View: "AnimatedView" },
    cancelAnimation: () => undefined,
    useSharedValue: (initial: number) => {
      const ref = useRef<{ value: number; get: () => number; set: (value: number) => void } | null>(null);
      if (ref.current === null) {
        ref.current = {
          value: initial,
          get() { return this.value; },
          set(value: number) {
            this.value = value;
            coverWrites.push(value);
          },
        };
      }
      return ref.current;
    },
    useAnimatedStyle: (style: () => unknown) => style(),
    withTiming: (value: number) => value,
  };
});
vi.mock("@shopify/flash-list", async () => {
  const { useState } = await import("react");
  return { useRecyclingState: useState };
});
vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({ isPending: false, mutate: vi.fn() }),
}));
vi.mock("@esports/auth", () => ({
  useAuthStore: (selector: (state: { accessToken: null; user: null }) => unknown) =>
    selector({ accessToken: null, user: null }),
}));
vi.mock("@fluentui/react-native-icons", () => ({ Add16Filled: () => null }));
vi.mock("expo-image", () => ({ Image: "Image" }));
vi.mock("expo-linear-gradient", () => ({ LinearGradient: "LinearGradient" }));
vi.mock("expo-router", () => ({ router: { push: vi.fn() } }));
vi.mock("@/features/circle/circle-player-pool", () => ({
  usePooledCirclePlayer: () => ({ slot: 0, player: {} }),
}));
vi.mock("@/features/circle/circle.api", () => ({
  setCircleAuthorFollowed: vi.fn(),
  setCircleVideoLiked: vi.fn(),
}));
vi.mock("@/features/circle/components/CircleActionIcons", () => ({
  CircleCommentIcon: () => null,
  CircleHeartIcon: () => null,
  CircleMoreIcon: () => null,
}));
vi.mock("@/features/circle/components/CircleCommentSheet", () => ({ CircleCommentSheet: () => null }));
vi.mock("@/features/circle/components/CircleContentText", () => ({ CircleContentText: () => null }));
vi.mock("@/features/circle/components/CircleMoreActionsSheet", () => ({ CircleMoreActionsSheet: () => null }));
vi.mock("@/features/circle/components/CircleVideoPlayer", () => ({ CircleVideoPlayer: "CircleVideoPlayer" }));
vi.mock("@/features/circle/components/CircleVideoProgressBar", () => ({ CircleVideoProgressBar: () => null }));
vi.mock("@/features/mine/blacklist", () => ({ addToBlacklist: vi.fn() }));
vi.mock("@/shared/navigation/require-login", () => ({ requireLogin: () => true }));
vi.mock("@/shared/ui/AppPrompt", () => ({ AppPrompt: () => null }));
vi.mock("@/shared/ui/app-toast", () => ({ showToast: vi.fn() }));
vi.mock("@/shared/theme/typography", () => ({ SYSTEM_FONT: "System" }));
vi.mock("@/features/circle/circle-data", () => ({ formatCircleCount: String }));

const post: CircleVideoPost = {
  id: "first",
  videoUrl: "https://example.com/first.mp4",
  cover: { uri: "https://example.com/first.jpg" },
  avatar: { uri: "https://example.com/avatar.jpg" },
  author: "作者",
  orderEnabled: false,
  content: "视频",
  tags: [],
  publishedAt: "刚刚",
  likeCount: 0,
  commentCount: 0,
};

describe("CircleVideoCard recycled cover", () => {
  it("卡片复用到下一条视频时等待新视频首帧再淡出封面", async () => {
    coverWrites.length = 0;
    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(
        <CircleVideoCard
          feedId="circle-home"
          post={post}
          bottomInset={0}
          height={800}
          active
          playing
          shouldPreload={false}
          shouldRetain={false}
          onPlaybackChange={() => undefined}
        />,
      );
    });
    await act(async () => {
      renderer?.root.findByType(VideoPlayerHost).props.onFirstFrame();
    });
    expect(coverWrites.at(-1)).toBe(0);

    await act(async () => {
      renderer?.update(
        <CircleVideoCard
          feedId="circle-home"
          post={{ ...post, id: "second", videoUrl: "https://example.com/second.mp4" }}
          bottomInset={0}
          height={800}
          active
          playing
          shouldPreload={false}
          shouldRetain={false}
          onPlaybackChange={() => undefined}
        />,
      );
    });
    expect(coverWrites.at(-1)).toBe(1);

    await act(async () => renderer?.unmount());
  });

  it("同一视频仍在播放窗口时切换激活状态不会重显封面", async () => {
    coverWrites.length = 0;
    let renderer: ReactTestRenderer | undefined;
    const renderCard = (active: boolean, shouldRetain: boolean) => (
      <CircleVideoCard
        feedId="circle-home"
        post={post}
        bottomInset={0}
        height={800}
        active={active}
        playing
        shouldPreload={false}
        shouldRetain={shouldRetain}
        onPlaybackChange={() => undefined}
      />
    );
    await act(async () => {
      renderer = create(renderCard(true, false));
    });
    await act(async () => {
      renderer?.root.findByType(VideoPlayerHost).props.onFirstFrame();
    });
    expect(coverWrites.at(-1)).toBe(0);
    const writesBeforeSwipe = coverWrites.length;

    await act(async () => {
      renderer?.update(renderCard(false, true));
    });
    await act(async () => {
      renderer?.update(renderCard(true, false));
    });
    expect(coverWrites.slice(writesBeforeSwipe)).not.toContain(1);

    await act(async () => renderer?.unmount());
  });
});
