import { Camera24Regular, Search24Regular } from "@fluentui/react-native-icons";
import { FlashList } from "@shopify/flash-list";
import { useInfiniteQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { FlashListRef, ListRenderItemInfo } from "@shopify/flash-list";
import { useAuthStore } from "@esports/auth";

import { fetchCircleFeedPage } from "@/features/circle/circle.api";
import type { CircleFeedKind, CircleVideoPost } from "@/features/circle/circle-data";
import { CIRCLE_HOME_FEED_ID, circlePlayerPool } from "@/features/circle/circle-player-pool";
import { CircleVideoCard } from "@/features/circle/components/CircleVideoCard";
import { useCircleBlockedUserIds } from "@/features/circle/use-circle-blocked-users";
import { CircleFeedSkeleton } from "@/features/circle/components/CircleFeedSkeleton";
import { EmptyState } from "@/shared/ui/AsyncStates";
import { useVoiceRoomSessionStore } from "@/features/voice-room/voice-room-session";
import { requireLogin } from "@/shared/navigation/require-login";
import { SYSTEM_FONT } from "@/shared/theme/typography";

const FEED_KINDS: { key: CircleFeedKind; label: string }[] = [
  { key: "latest", label: "最新" },
  { key: "hot", label: "最热" },
  { key: "follow", label: "关注" },
];

/** 顶部渐变遮罩在安全区之外的高度，叠加 insets.top 覆盖状态栏区域。 */
const TOP_MASK_HEIGHT = 120;
const TAB_SWIPE_DISTANCE = 60;
const TAB_SWIPE_VELOCITY = 700;

type CircleScreenProps = {
  active: boolean;
  bottomInset: number;
};

export function CircleScreen({ active, bottomInset }: CircleScreenProps) {
  const insets = useSafeAreaInsets();
  const [kind, setKind] = useState<CircleFeedKind>("latest");
  const [activePage, setActivePage] = useState<{ kind: CircleFeedKind; index: number }>({
    kind: "latest",
    index: 0,
  });
  const [hasSwiped, setHasSwiped] = useState(false);
  const [manualPlayback, setManualPlayback] = useState<{
    videoId: string;
    isPlaying: boolean;
  } | null>(null);
  const [feedHeight, setFeedHeight] = useState(0);
  const [appIsActive, setAppIsActive] = useState(AppState.currentState === "active");
  const listRef = useRef<FlashListRef<CircleVideoPost>>(null);
  const accessToken = useAuthStore((state) => state.accessToken);
  const isCompanion = useAuthStore((state) => state.isCompanion);
  const blockedUserIds = useCircleBlockedUserIds();
  const previousBlockedUserIdsRef = useRef(blockedUserIds);
  const activeRoom = useVoiceRoomSessionStore((state) => state.activeRoom);
  const joiningRoom = useVoiceRoomSessionStore((state) => state.joiningRoom);
  const shouldPlay = active && appIsActive && !activeRoom && !joiningRoom;
  const feedKind = kind === "follow" && !accessToken ? "latest" : kind;
  const activeIndex = activePage.kind === feedKind ? activePage.index : 0;

  const feedQuery = useInfiniteQuery({
    queryKey: ["circle-feed", feedKind, accessToken ?? "guest"],
    enabled: active,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      fetchCircleFeedPage({ kind: feedKind, cursor: pageParam, token: accessToken ?? undefined, signal }),
    getNextPageParam: (lastPage) =>
      lastPage.hasMore && lastPage.nextCursor ? lastPage.nextCursor : undefined,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  const posts = useMemo(
    () => {
      if (blockedUserIds === null) {
        return [];
      }
      const seen = new Set<string>();
      return (feedQuery.data?.pages.flatMap((page) => page.list) ?? []).filter((post) => {
        if (seen.has(post.id) || (post.authorId && blockedUserIds.has(post.authorId))) {
          return false;
        }
        seen.add(post.id);
        return true;
      });
    },
    [feedQuery.data, blockedUserIds],
  );
  const visibleActiveIndex = Math.min(activeIndex, Math.max(posts.length - 1, 0));

  useEffect(() => {
    if (blockedUserIds === null || previousBlockedUserIdsRef.current === blockedUserIds) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      previousBlockedUserIdsRef.current = blockedUserIds;
      if (visibleActiveIndex !== activeIndex) {
        setActivePage({ kind: feedKind, index: visibleActiveIndex });
      }
      listRef.current?.scrollToOffset({ offset: visibleActiveIndex * feedHeight, animated: false });
    });
    return () => cancelAnimationFrame(frame);
  }, [activeIndex, blockedUserIds, feedHeight, feedKind, visibleActiveIndex]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      setAppIsActive(state === "active");
    });
    return () => subscription.remove();
  }, []);

  // 路由焦点仲裁：active 含 HomeScreen 的 topTab 与路由 focus，push 话题页/作品页时让出播放权
  useEffect(() => {
    if (active) {
      circlePlayerPool.activateFeed(CIRCLE_HOME_FEED_ID);
    } else {
      circlePlayerPool.conditionalRelease(CIRCLE_HOME_FEED_ID);
    }
  }, [active]);

  useEffect(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [feedKind]);

  const selectKind = useCallback((next: CircleFeedKind) => {
    if (next === "follow" && !requireLogin()) {
      return;
    }
    setKind(next);
    setActivePage({ kind: next, index: 0 });
    setHasSwiped(false);
    setManualPlayback(null);
  }, []);

  const tabSwipeGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(active)
        .maxPointers(1)
        .activeOffsetX([-20, 20])
        .failOffsetY([-16, 16])
        .runOnJS(true)
        .onEnd((event, success) => {
          if (!success || Math.abs(event.translationX) <= Math.abs(event.translationY)) {
            return;
          }
          if (
            Math.abs(event.translationX) < TAB_SWIPE_DISTANCE &&
            Math.abs(event.velocityX) < TAB_SWIPE_VELOCITY
          ) {
            return;
          }
          const currentIndex = FEED_KINDS.findIndex((item) => item.key === feedKind);
          const next = FEED_KINDS[currentIndex + (event.translationX < 0 ? 1 : -1)];
          if (next) {
            selectKind(next.key);
          }
        }),
    [active, feedKind, selectKind],
  );

  const renderPost = useCallback(
    ({ item, index }: ListRenderItemInfo<CircleVideoPost>) => {
      const autoPlay = hasSwiped || index > 0;
      const isPlaying = manualPlayback?.videoId === item.id
        ? manualPlayback.isPlaying
        : autoPlay;
      return (
        <CircleVideoCard
          feedId={CIRCLE_HOME_FEED_ID}
          post={item}
          bottomInset={bottomInset}
          height={feedHeight}
          active={shouldPlay && index === visibleActiveIndex}
          playing={isPlaying}
          onPlaybackChange={(nextPlaying) => {
            setManualPlayback({ videoId: item.id, isPlaying: nextPlaying });
          }}
          onBlockSuccess={() => {
            setHasSwiped(true);
            setManualPlayback(null);
          }}
          shouldPreload={shouldPlay && index === visibleActiveIndex + 1}
          shouldRetain={shouldPlay && index === visibleActiveIndex - 1}
        />
      );
    },
    [visibleActiveIndex, bottomInset, feedHeight, hasSwiped, manualPlayback, shouldPlay],
  );
  const listExtraData = useMemo(
    () => ({ visibleActiveIndex, feedHeight, hasSwiped, manualPlayback, shouldPlay, bottomInset }),
    [visibleActiveIndex, feedHeight, hasSwiped, manualPlayback, shouldPlay, bottomInset],
  );

  const handleEndReached = useCallback(() => {
    if (feedQuery.hasNextPage && !feedQuery.isFetchingNextPage) {
      void feedQuery.fetchNextPage();
    }
  }, [feedQuery]);

  const screen = (
    <View
      style={styles.root}
      onLayout={(event) => {
        const nextHeight = event.nativeEvent.layout.height;
        if (nextHeight > 0 && nextHeight !== feedHeight) {
          setFeedHeight(nextHeight);
        }
      }}
    >
      {feedHeight > 0 ? (
        <FlashList
          ref={listRef}
          data={posts}
          extraData={listExtraData}
          keyExtractor={(item) => item.id}
          renderItem={renderPost}
          getItemType={() => "video"}
          drawDistance={feedHeight * 2}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.6}
          onMomentumScrollEnd={(event) => {
            if (feedHeight <= 0) {
              return;
            }
            const index = Math.round(event.nativeEvent.contentOffset.y / feedHeight);
            if (index !== visibleActiveIndex) {
              setHasSwiped(true);
              setManualPlayback(null);
            }
            setActivePage({
              kind: feedKind,
              index: Math.max(0, Math.min(index, posts.length - 1)),
            });
          }}
          refreshing={feedQuery.isRefetching && !feedQuery.isFetchingNextPage}
          onRefresh={() => {
            void feedQuery.refetch();
          }}
        />
      ) : null}

      {(feedQuery.isLoading || blockedUserIds === null) && posts.length === 0 ? (
        <CircleFeedSkeleton bottomInset={bottomInset} />
      ) : null}
      {blockedUserIds !== null && !feedQuery.isLoading && feedQuery.isError && posts.length === 0 ? (
        <Pressable
          style={styles.stateOverlay}
          onPress={() => {
            void feedQuery.refetch();
          }}
        >
          <Text style={styles.stateText}>加载失败，点击重试</Text>
        </Pressable>
      ) : null}
      {blockedUserIds !== null && feedQuery.isSuccess && posts.length === 0 ? (
        <View style={styles.stateOverlay} pointerEvents="none">
          <EmptyState message="还没有视频，来看看其他内容吧" />
        </View>
      ) : null}

      <LinearGradient
        colors={["rgba(0, 0, 0, 0.7)", "rgba(0, 0, 0, 0)"]}
        style={[styles.topMask, { height: TOP_MASK_HEIGHT + insets.top }]}
        pointerEvents="none"
      />
      <View style={[styles.navBar, { top: insets.top }]} pointerEvents="box-none">
        {isCompanion ? (
          <Pressable
            accessibilityLabel="发布视频"
            onPress={() => {
              if (requireLogin()) {
                router.push("/circle/publish");
              }
            }}
            style={styles.navSide}
          >
            <Camera24Regular color="#FFFFFF" style={styles.navIcon} />
          </Pressable>
        ) : (
          <View style={styles.navSide} />
        )}
        <View style={styles.navTabs}>
          {FEED_KINDS.map((item) => {
            const selected = feedKind === item.key;
            return (
              <Pressable
                key={item.key}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                onPress={() => selectKind(item.key)}
                style={styles.navTab}
              >
                <Text style={[styles.navTabText, selected && styles.navTabTextSelected]}>
                  {item.label}
                </Text>
                {selected ? <View style={styles.navTabIndicator} /> : null}
              </Pressable>
            );
          })}
        </View>
        <Pressable
          accessibilityLabel="搜索"
          onPress={() => {
            router.push("/circle/search");
          }}
          style={styles.navSide}
        >
          <Search24Regular color="#FFFFFF" style={styles.navIcon} />
        </Pressable>
      </View>
      {active ? <StatusBar style="light" /> : null}
    </View>
  );

  return <GestureDetector gesture={tabSwipeGesture}>{screen}</GestureDetector>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000000" },
  topMask: { position: "absolute", top: 0, left: 0, right: 0 },
  navBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 2,
  },
  navSide: { width: 48, height: 44, alignItems: "center", justifyContent: "center" },
  navIcon: { width: 24, height: 24 },
  navTabs: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  navTab: {
    height: 26,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    position: "relative",
  },
  navTabText: {
    fontFamily: SYSTEM_FONT,
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "400",
  },
  navTabTextSelected: { color: "#FFFFFF", fontWeight: "600" },
  navTabIndicator: {
    position: "absolute",
    bottom: 0,
    width: 12,
    height: 2,
    borderRadius: 1,
    backgroundColor: "#FFFFFF",
  },
  stateOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111111",
    zIndex: 1,
  },
  stateText: { color: "#FFFFFF", fontFamily: SYSTEM_FONT, fontSize: 14 },
});
