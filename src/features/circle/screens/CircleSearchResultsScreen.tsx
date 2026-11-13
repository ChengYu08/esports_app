import { ChevronLeft24Regular } from "@fluentui/react-native-icons";
import { FlashList } from "@shopify/flash-list";
import { useInfiniteQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { router, useFocusEffect, useIsFocused, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { FlashListRef, ListRenderItemInfo } from "@shopify/flash-list";
import { useAuthStore } from "@esports/auth";

import { fetchCircleSearchPage } from "@/features/circle/circle.api";
import type { CircleVideoPost } from "@/features/circle/circle-data";
import { circlePlayerPool } from "@/features/circle/circle-player-pool";
import { CircleVideoCard } from "@/features/circle/components/CircleVideoCard";
import { useCircleBlockedUserIds } from "@/features/circle/use-circle-blocked-users";
import { CircleFeedSkeleton } from "@/features/circle/components/CircleFeedSkeleton";
import { EmptyState } from "@/shared/ui/AsyncStates";
import { useVoiceRoomSessionStore } from "@/features/voice-room/voice-room-session";
import { SYSTEM_FONT } from "@/shared/theme/typography";

export default function CircleSearchResultsScreen() {
  const insets = useSafeAreaInsets();
  const { kw, topic, videoId } = useLocalSearchParams<{ kw?: string; topic?: string; videoId?: string }>();
  const keyword = (kw ?? "").trim() || (topic ?? "").trim();
  const isTopicSearch = !kw && Boolean(topic);
  const targetVideoId = (videoId ?? "").trim();
  const [activeIndex, setActiveIndex] = useState(0);
  const [hasSwiped, setHasSwiped] = useState(false);
  const [manualPlayback, setManualPlayback] = useState<{
    videoId: string;
    isPlaying: boolean;
  } | null>(null);
  const [feedHeight, setFeedHeight] = useState(0);
  const [appIsActive, setAppIsActive] = useState(AppState.currentState === "active");
  const listRef = useRef<FlashListRef<CircleVideoPost>>(null);
  const accessToken = useAuthStore((state) => state.accessToken);
  const blockedUserIds = useCircleBlockedUserIds();
  const previousBlockedUserIdsRef = useRef(blockedUserIds);
  const activeRoom = useVoiceRoomSessionStore((state) => state.activeRoom);
  const joiningRoom = useVoiceRoomSessionStore((state) => state.joiningRoom);
  const shouldPlay = appIsActive && !activeRoom && !joiningRoom;
  const focused = useIsFocused();
  // 播放资格 = 自身条件 AND 路由焦点：上层再压路由时让出全局播放器池
  const feedActive = shouldPlay && focused;
  const feedId = useMemo(() => `circle-search:${keyword}`, [keyword]);

  // 焦点仲裁：聚焦时接管播放器池，失焦时条件释放（仅当自己仍持仲裁权）
  useFocusEffect(
    useCallback(() => {
      circlePlayerPool.activateFeed(feedId);
      return () => {
        circlePlayerPool.conditionalRelease(feedId);
      };
    }, [feedId]),
  );

  const searchQuery = useInfiniteQuery({
    queryKey: ["circle-search", keyword, isTopicSearch, accessToken ?? "guest"],
    enabled: Boolean(keyword),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      fetchCircleSearchPage({
        keyword,
        keywordType: isTopicSearch ? 1 : undefined,
        cursor: pageParam,
        token: accessToken ?? undefined,
        signal,
      }),
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
      return (searchQuery.data?.pages.flatMap((page) => page.list) ?? []).filter((post) => {
        if (seen.has(post.id) || (post.authorId && blockedUserIds.has(post.authorId))) {
          return false;
        }
        seen.add(post.id);
        return true;
      });
    },
    [searchQuery.data, blockedUserIds],
  );
  const visibleActiveIndex = Math.min(activeIndex, Math.max(posts.length - 1, 0));

  useEffect(() => {
    if (blockedUserIds === null || previousBlockedUserIdsRef.current === blockedUserIds) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      previousBlockedUserIdsRef.current = blockedUserIds;
      if (visibleActiveIndex !== activeIndex) {
        setActiveIndex(visibleActiveIndex);
      }
      listRef.current?.scrollToOffset({ offset: visibleActiveIndex * feedHeight, animated: false });
    });
    return () => cancelAnimationFrame(frame);
  }, [activeIndex, blockedUserIds, feedHeight, visibleActiveIndex]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      setAppIsActive(state === "active");
    });
    return () => subscription.remove();
  }, []);

  // 从瀑布流点进的场景：定位到被点击的那条视频（数据分页到达后生效，只定位一次）
  const positionedRef = useRef(false);
  useEffect(() => {
    if (!targetVideoId || positionedRef.current || feedHeight <= 0 || posts.length === 0) {
      return;
    }
    const index = posts.findIndex((post) => post.id === targetVideoId);
    if (index < 0) {
      return;
    }
    positionedRef.current = true;
    requestAnimationFrame(() => {
      if (index > 0) {
        listRef.current?.scrollToIndex({ index, animated: false });
      }
      setActiveIndex(index);
    });
  }, [targetVideoId, feedHeight, posts]);

  const renderPost = useCallback(
    ({ item, index }: ListRenderItemInfo<CircleVideoPost>) => {
      const autoPlay = hasSwiped || index > 0;
      const isPlaying = manualPlayback?.videoId === item.id
        ? manualPlayback.isPlaying
        : autoPlay;
      return (
        <CircleVideoCard
          feedId={feedId}
          post={item}
          bottomInset={0}
          height={feedHeight}
          active={feedActive && index === visibleActiveIndex}
          playing={isPlaying}
          onPlaybackChange={(nextPlaying) => {
            setManualPlayback({ videoId: item.id, isPlaying: nextPlaying });
          }}
          onBlockSuccess={() => {
            setHasSwiped(true);
            setManualPlayback(null);
          }}
          shouldPreload={feedActive && index === visibleActiveIndex + 1}
          shouldRetain={feedActive && index === visibleActiveIndex - 1}
        />
      );
    },
    [visibleActiveIndex, feedId, feedHeight, hasSwiped, manualPlayback, feedActive],
  );
  const listExtraData = useMemo(
    () => ({ visibleActiveIndex, feedId, feedHeight, hasSwiped, manualPlayback, feedActive }),
    [visibleActiveIndex, feedId, feedHeight, hasSwiped, manualPlayback, feedActive],
  );

  const handleEndReached = useCallback(() => {
    if (searchQuery.hasNextPage && !searchQuery.isFetchingNextPage) {
      void searchQuery.fetchNextPage();
    }
  }, [searchQuery]);

  const headerTitle = isTopicSearch ? `话题：#${keyword}` : `搜索：${keyword}`;

  return (
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
          // 放行评论弹窗内的按钮点击，保留评论输入焦点。
          keyboardShouldPersistTaps="handled"
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
            setActiveIndex(Math.max(0, Math.min(index, posts.length - 1)));
          }}
          refreshing={searchQuery.isRefetching && !searchQuery.isFetchingNextPage}
          onRefresh={() => {
            void searchQuery.refetch();
          }}
        />
      ) : null}

      {(searchQuery.isLoading || blockedUserIds === null) && posts.length === 0 ? (
        <CircleFeedSkeleton bottomInset={0} />
      ) : null}
      {searchQuery.isLoading || blockedUserIds === null || posts.length > 0 || !keyword ? null : searchQuery.isError ? (
        <Pressable
          style={styles.stateOverlay}
          onPress={() => {
            void searchQuery.refetch();
          }}
        >
          <Text style={styles.stateText}>加载失败，点击重试</Text>
        </Pressable>
      ) : (
        <View style={styles.stateOverlay} pointerEvents="none">
          <EmptyState
            message={isTopicSearch ? "该话题还没有视频" : "没有找到相关内容，换个词试试吧"}
          />
        </View>
      )}

      <LinearGradient
        colors={["rgba(0, 0, 0, 0.7)", "rgba(0, 0, 0, 0)"]}
        // 渐变从物理屏顶铺起（盖住状态栏），总高同步加 insets.top，导航行处的明暗与主盼友圈一致。
        style={[styles.topMask, { height: insets.top + 120 }]}
        pointerEvents="none"
      />
      <View style={[styles.navBar, { top: insets.top }]} pointerEvents="box-none">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="返回"
          onPress={() => {
            router.back();
          }}
          style={styles.back}
        >
          <ChevronLeft24Regular color="#FFFFFF" style={styles.backIcon} />
        </Pressable>
        <Text style={styles.navTitle} numberOfLines={1}>
          {headerTitle}
        </Text>
      </View>
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000000" },
  topMask: { position: "absolute", top: 0, left: 0, right: 0, height: 120 },
  navBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 44,
    flexDirection: "row",
    alignItems: "center",
  },
  back: { width: 48, height: 44, alignItems: "center", justifyContent: "center" },
  backIcon: { width: 24, height: 24 },
  navTitle: {
    flex: 1,
    fontFamily: SYSTEM_FONT,
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "500",
    paddingRight: 48,
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
