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

import {
  fetchMyCirclePage,
  fetchUserCirclePage,
  profileCirclePostToFeedPost,
} from "@/features/circle/circle.api";
import type { CircleVideoPost } from "@/features/circle/circle-data";
import { circlePlayerPool } from "@/features/circle/circle-player-pool";
import { CircleVideoCard } from "@/features/circle/components/CircleVideoCard";
import { CircleFeedSkeleton } from "@/features/circle/components/CircleFeedSkeleton";
import { EmptyState } from "@/shared/ui/AsyncStates";
import { useVoiceRoomSessionStore } from "@/features/voice-room/voice-room-session";
import { SYSTEM_FONT } from "@/shared/theme/typography";

const USER_VIDEO_PAGE_SIZE = 10;

/** 个人主页盼友圈卡片进入的作品全屏播放页，定位到被点击的那条视频。 */
export default function CircleUserVideosScreen() {
  const insets = useSafeAreaInsets();
  const { userId, postId, nickname, avatar } = useLocalSearchParams<{
    userId?: string;
    postId?: string;
    nickname?: string;
    avatar?: string;
  }>();
  const currentUserId = useAuthStore((state) => state.user?.id);
  const accessToken = useAuthStore((state) => state.accessToken);
  const isMine = Boolean(userId) && String(currentUserId ?? "") === userId;
  const [activeIndex, setActiveIndex] = useState(0);
  const [manualPlayback, setManualPlayback] = useState<{
    videoId: string;
    isPlaying: boolean;
  } | null>(null);
  const [feedHeight, setFeedHeight] = useState(0);
  const [appIsActive, setAppIsActive] = useState(AppState.currentState === "active");
  const listRef = useRef<FlashListRef<CircleVideoPost>>(null);
  // 仅定位一次；目标视频可能在后面的分页里，加载到为止
  const pendingPostIdRef = useRef(postId && postId !== "" ? postId : null);
  const activeRoom = useVoiceRoomSessionStore((state) => state.activeRoom);
  const joiningRoom = useVoiceRoomSessionStore((state) => state.joiningRoom);
  const shouldPlay = appIsActive && !activeRoom && !joiningRoom;
  const focused = useIsFocused();
  // 播放资格 = 自身条件 AND 路由焦点：上层再压路由时让出全局播放器池
  const feedActive = shouldPlay && focused;
  const feedId = useMemo(() => `circle-user:${userId ?? "mine"}`, [userId]);

  // 焦点仲裁：聚焦时接管播放器池，失焦时条件释放（仅当自己仍持仲裁权）
  useFocusEffect(
    useCallback(() => {
      circlePlayerPool.activateFeed(feedId);
      return () => {
        circlePlayerPool.conditionalRelease(feedId);
      };
    }, [feedId]),
  );

  const videoQuery = useInfiniteQuery({
    queryKey: ["circle-user-videos", userId, isMine, accessToken ?? "guest"],
    enabled: Boolean(userId) && (!isMine || Boolean(accessToken)),
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => {
      if (isMine) {
        return fetchMyCirclePage({
          page: pageParam,
          pageSize: USER_VIDEO_PAGE_SIZE,
          token: accessToken ?? "",
          signal,
        });
      }
      return fetchUserCirclePage({
        userId: userId ?? "",
        page: pageParam,
        pageSize: USER_VIDEO_PAGE_SIZE,
        signal,
      });
    },
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      if (!lastPage.hasMore) {
        return undefined;
      }
      return (lastPageParam as number) + 1;
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  const posts = useMemo(
    () => {
      const author = { userId, nickname, avatar };
      const seen = new Set<string>();
      return (videoQuery.data?.pages.flatMap((page) => page.list) ?? [])
        .filter((post) => post.status === "APPROVED" && post.videoUrl !== "")
        .map((post) => profileCirclePostToFeedPost(post, author))
        .filter((post) => {
          if (seen.has(post.id)) {
            return false;
          }
          seen.add(post.id);
          return true;
        });
    },
    [videoQuery.data, userId, nickname, avatar],
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      setAppIsActive(state === "active");
    });
    return () => subscription.remove();
  }, []);

  // 定位被点击的视频：当前页没有就继续翻页，找到后一次性滚过去
  useEffect(() => {
    if (!pendingPostIdRef.current || feedHeight <= 0 || posts.length === 0) {
      return;
    }
    const index = posts.findIndex((post) => post.id === pendingPostIdRef.current);
    if (index >= 0) {
      pendingPostIdRef.current = null;
      setActiveIndex(index);
      listRef.current?.scrollToIndex({ index, animated: false });
      return;
    }
    if (videoQuery.hasNextPage && !videoQuery.isFetchingNextPage) {
      void videoQuery.fetchNextPage();
    }
  }, [posts, feedHeight, videoQuery]);

  const renderPost = useCallback(
    ({ item, index }: ListRenderItemInfo<CircleVideoPost>) => {
      // 本页始终由用户在个人主页点选某条视频进入，进入即自动播放（含第一条）
      const isPlaying = manualPlayback?.videoId === item.id
        ? manualPlayback.isPlaying
        : true;
      return (
        <CircleVideoCard
          feedId={feedId}
          post={item}
          bottomInset={0}
          height={feedHeight}
          active={feedActive && index === activeIndex}
          playing={isPlaying}
          onPlaybackChange={(nextPlaying) => {
            setManualPlayback({ videoId: item.id, isPlaying: nextPlaying });
          }}
          shouldPreload={feedActive && index === activeIndex + 1}
          shouldRetain={feedActive && index === activeIndex - 1}
        />
      );
    },
    [activeIndex, feedId, feedHeight, manualPlayback, feedActive],
  );

  const handleEndReached = useCallback(() => {
    if (videoQuery.hasNextPage && !videoQuery.isFetchingNextPage) {
      void videoQuery.fetchNextPage();
    }
  }, [videoQuery]);

  const headerTitle = nickname ? `${nickname}的作品` : "盼友圈作品";

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
          ref={listRef}
          data={posts}
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
            if (index !== activeIndex) {
              setManualPlayback(null);
            }
            setActiveIndex(Math.max(0, Math.min(index, posts.length - 1)));
          }}
          refreshing={videoQuery.isRefetching && !videoQuery.isFetchingNextPage}
          onRefresh={() => {
            void videoQuery.refetch();
          }}
        />
      ) : null}

      {videoQuery.isLoading && posts.length === 0 ? (
        <CircleFeedSkeleton bottomInset={0} />
      ) : null}
      {videoQuery.isLoading || posts.length > 0 || !userId ? null : videoQuery.isError ? (
        <Pressable
          style={styles.stateOverlay}
          onPress={() => {
            void videoQuery.refetch();
          }}
        >
          <Text style={styles.stateText}>加载失败，点击重试</Text>
        </Pressable>
      ) : (
        <View style={styles.stateOverlay} pointerEvents="none">
          <EmptyState message="TA还没有发布作品" />
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
