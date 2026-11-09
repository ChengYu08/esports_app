import {
  Add16Filled,
} from "@fluentui/react-native-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, TextLayoutEvent, View } from "react-native";
import { router } from "expo-router";
import { useCallback, useEffect, useRef } from "react";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useMutation } from "@tanstack/react-query";
import { useRecyclingState } from "@shopify/flash-list";
import { useAuthStore } from "@esports/auth";
import { requireLogin } from "@/shared/navigation/require-login";

import {
  formatCircleCount,
  type CircleVideoPost,
} from "@/features/circle/circle-data";
import { showToast } from "@/shared/ui/app-toast";
import { SYSTEM_FONT } from "@/shared/theme/typography";
import { setCircleVideoLiked, setCircleAuthorFollowed } from "@/features/circle/circle.api";
import { CircleVideoPlayer } from "@/features/circle/components/CircleVideoPlayer";
import { CircleCommentSheet } from "@/features/circle/components/CircleCommentSheet";
import {
  CircleCommentIcon,
  CircleHeartIcon,
} from "@/features/circle/components/CircleActionIcons";

/** 底部信息区的大致占位高度，右侧操作栏以此为基准向上排布。 */
const BOTTOM_INFO_HEIGHT = 190;
/** 与 AppTabBar 一致的内容区高度。 */
const TAB_CONTENT_HEIGHT = 58;

type CircleVideoCardProps = {
  post: CircleVideoPost;
  bottomInset: number;
  /** 信息流可视高度，翻页依赖整屏高度定位。 */
  height: number;
  active: boolean;
  playing: boolean;
  onPlaybackChange: (playing: boolean) => void;
  shouldPreload: boolean;
  /** 上一页卡片保留播放器，把卸载开销从翻页落定瞬间错开。 */
  shouldRetain: boolean;
};

export function CircleVideoCard({
  post,
  bottomInset,
  height,
  active,
  playing,
  onPlaybackChange,
  shouldPreload,
  shouldRetain,
}: CircleVideoCardProps) {
  const token = useAuthStore((state) => state.accessToken);
  const [liked, setLiked] = useRecyclingState(post.liked ?? false, [post.id, post.liked]);
  const [followed, setFollowed] = useRecyclingState(post.followed ?? false, [post.id, post.followed]);
  const [expanded, setExpanded] = useRecyclingState(false, [post.id]);
  const [needsExpand, setNeedsExpand] = useRecyclingState(false, [post.id]);
  const [commentSheetVisible, setCommentSheetVisible] = useRecyclingState(false, [post.id]);
  const [playError, setPlayError] = useRecyclingState(false, [post.id, active]);
  const [playerAttempt, setPlayerAttempt] = useRecyclingState(0, [post.id]);
  const coverOpacity = useSharedValue(1);
  const frameReadyRef = useRef(false);
  const coverAnimatedStyle = useAnimatedStyle(() => ({ opacity: coverOpacity.get() }));
  const likeMutation = useMutation({
    mutationFn: (nextLiked: boolean) => {
      if (!token) {
        throw new Error("请先登录");
      }
      return setCircleVideoLiked({ videoId: post.id, liked: nextLiked, token });
    },
    onSuccess: (serverLiked) => {
      setLiked(serverLiked);
    },
    onError: (error) => {
      showToast(error instanceof Error ? error.message : "点赞操作失败");
    },
  });
  const followMutation = useMutation({
    mutationFn: (nextFollowed: boolean) => {
      if (!token || !post.authorId) {
        throw new Error("关注作者失败");
      }
      return setCircleAuthorFollowed({
        authorId: post.authorId,
        followed: nextFollowed,
        token,
      });
    },
    onSuccess: (serverFollowed) => {
      setFollowed(serverFollowed);
      showToast(serverFollowed ? "关注成功" : "已取消关注");
    },
    onError: (error) => {
      showToast(error instanceof Error ? error.message : "关注操作失败");
    },
  });
  const actionBarBottom = TAB_CONTENT_HEIGHT + bottomInset + BOTTOM_INFO_HEIGHT;
  const bottomPadding = TAB_CONTENT_HEIGHT + bottomInset + 12;

  useEffect(() => {
    cancelAnimation(coverOpacity);
    coverOpacity.set(1);
    if (active && frameReadyRef.current) {
      coverOpacity.set(withTiming(0, { duration: 180 }));
    }
    if (!active && !shouldPreload && !shouldRetain) {
      frameReadyRef.current = false;
    }
  }, [active, coverOpacity, playerAttempt, post.id, shouldPreload, shouldRetain]);

  const handlePlayerReady = useCallback(() => {
    frameReadyRef.current = true;
    setPlayError(false);
    if (active) {
      coverOpacity.set(withTiming(0, { duration: 180 }));
    }
  }, [active, coverOpacity, setPlayError]);
  const handlePlayerError = useCallback(() => {
    setPlayError(true);
    onPlaybackChange(false);
    cancelAnimation(coverOpacity);
    coverOpacity.set(1);
  }, [coverOpacity, onPlaybackChange, setPlayError]);

  const handlePlay = () => {
    if (playError) {
      setPlayError(false);
      setPlayerAttempt((attempt) => attempt + 1);
      onPlaybackChange(true);
      return;
    }
    onPlaybackChange(!playing);
  };
  const handleLike = () => {
    if (!requireLogin() || likeMutation.isPending) {
      return;
    }
    likeMutation.mutate(!liked);
  };
  const handleComment = () => {
    setCommentSheetVisible(true);
  };
  /** 测量完整正文行数，超过两行才展示“展开”入口。 */
  const handleContentMeasure = (event: TextLayoutEvent) => {
    setNeedsExpand(event.nativeEvent.lines.length > 2);
  };
  const handleFollow = () => {
    if (!requireLogin() || followMutation.isPending) {
      return;
    }
    followMutation.mutate(!followed);
  };
  const handleOrder = () => {
    showToast("下单功能开发中");
  };

  return (
    <View style={[styles.card, { height }]}>
      {post.videoUrl && (active || shouldPreload || shouldRetain) ? (
        <CircleVideoPlayer
          key={`${post.id}:${playerAttempt}`}
          post={post}
          active={active}
          shouldPlay={active && playing}
          shouldPreload={shouldPreload}
          token={token ?? undefined}
          onFirstFrame={handlePlayerReady}
          onError={handlePlayerError}
        />
      ) : null}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.coverOverlay, coverAnimatedStyle]}
      >
        <Image source={post.cover} style={StyleSheet.absoluteFill} contentFit="cover" />
      </Animated.View>
      {active ? (
        <Pressable
          accessibilityLabel={playing ? "暂停视频" : "播放视频"}
          onPress={handlePlay}
          style={styles.playButton}
        >
          {playError ? (
            <Text style={styles.retryText}>播放失败，点击重试</Text>
          ) : !playing ? (
            <Image
              source={require("../../../../assets/svgs/circle-play.svg")}
              style={styles.playIcon}
            />
          ) : null}
        </Pressable>
      ) : null}

      <View style={[styles.actionBar, { bottom: actionBarBottom }]}>
        <View style={styles.avatarItem}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`查看${post.author}的主页`}
            disabled={!post.authorId}
            onPress={() => {
              if (!post.authorId) {
                return;
              }
              onPlaybackChange(false);
              router.push({ pathname: "/profile", params: { userId: post.authorId } });
            }}
          >
            <Image source={post.avatar} style={styles.avatar} contentFit="cover" />
          </Pressable>
          {!followed ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`关注${post.author}`}
              disabled={!post.authorId}
              onPress={handleFollow}
              style={styles.followBadge}
            >
              <View style={styles.followBadgeBg}>
                <Add16Filled color="#FFFFFF" style={styles.followIcon} />
              </View>
            </Pressable>
          ) : null}
        </View>
        <Pressable accessibilityLabel="点赞" style={styles.actionItem} onPress={handleLike}>
          <CircleHeartIcon color={liked ? "#FE4267" : "#FFFFFF"} />
          <Text style={styles.actionCount}>
            {formatCircleCount(post.likeCount + (liked ? 1 : 0))}
          </Text>
        </Pressable>
        <Pressable accessibilityLabel="评论" style={styles.actionItem} onPress={handleComment}>
          <CircleCommentIcon color="#FFFFFF" />
          <Text style={styles.actionCount}>{formatCircleCount(post.commentCount)}</Text>
        </Pressable>
      </View>

      <LinearGradient
        colors={["rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 0.7)"]}
        style={[styles.bottomGradient, { paddingBottom: bottomPadding }]}
        pointerEvents="none"
      />
      <View style={[styles.bottomInfo, { paddingBottom: bottomPadding }]}>
        <View style={styles.contentGroup}>
          {post.orderEnabled ? (
            <Pressable accessibilityLabel="去下单" onPress={handleOrder}>
              <LinearGradient
                colors={["#FF8C6C", "#F92E7F"]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.orderTag}
              >
                <Text style={styles.orderTagText}>去下单</Text>
              </LinearGradient>
            </Pressable>
          ) : null}
          <Text style={styles.title}>{post.author}</Text>
          {post.headline ? <Text style={styles.headline}>{post.headline}</Text> : null}
          <View style={styles.contentRow}>
            <Text style={styles.content} numberOfLines={expanded ? undefined : 2}>
              {post.content}
              <Text style={styles.tags}> {post.tags.join(" ")}</Text>
            </Text>
            {needsExpand ? (
              <Pressable
                accessibilityLabel={expanded ? "收起全文" : "展开全文"}
                onPress={() => {
                  setExpanded((current) => !current);
                }}
              >
                <Text style={styles.expand}>{expanded ? "收起" : "展开"}</Text>
              </Pressable>
            ) : null}
            <Text
              onTextLayout={handleContentMeasure}
              pointerEvents="none"
              style={[styles.content, styles.contentMeasure]}
            >
              {post.content}
              <Text style={styles.tags}> {post.tags.join(" ")}</Text>
            </Text>
          </View>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>{post.publishedAt}</Text>
          <Text style={styles.meta}>作者声明：内容为个人观念或见解</Text>
        </View>
      </View>

      <CircleCommentSheet
        visible={commentSheetVisible}
        onClose={() => {
          setCommentSheetVisible(false);
        }}
        post={post}
        followed={followed}
        onToggleFollow={handleFollow}
        token={token ?? undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: "100%", backgroundColor: "#000000" },
  coverOverlay: { zIndex: 1 },
  playButton: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  playIcon: { width: 88, height: 88 },
  retryText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
  actionBar: {
    position: "absolute",
    right: 0,
    zIndex: 3,
    paddingHorizontal: 8,
    paddingVertical: 16,
    gap: 16,
  },
  actionItem: { alignItems: "center" },
  avatarItem: {
    width: 48,
    height: 60,
    alignItems: "center",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  followBadge: { marginTop: -12 },
  followBadgeBg: {
    width: 24,
    height: 24,
    borderRadius: 999,
    backgroundColor: "#FE1F4C",
    alignItems: "center",
    justifyContent: "center",
  },
  followIcon: { width: 16, height: 16 },
  actionCount: {
    fontFamily: SYSTEM_FONT,
    color: "#FFFFFF",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "500",
    textAlign: "center",
  },
  bottomGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "flex-end",
  },
  bottomInfo: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 3,
    paddingHorizontal: 16,
    gap: 8,
  },
  contentGroup: { gap: 4 },
  orderTag: {
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 3,
    justifyContent: "center",
  },
  orderTagText: {
    fontFamily: SYSTEM_FONT,
    color: "#FFFFFF",
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "500",
  },
  title: {
    fontFamily: SYSTEM_FONT,
    color: "#FFFFFF",
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
  },
  headline: {
    fontFamily: SYSTEM_FONT,
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "500",
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  content: {
    flex: 1,
    fontFamily: SYSTEM_FONT,
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "400",
  },
  tags: { color: "#99B6FF" },
  contentMeasure: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    opacity: 0,
  },
  expand: {
    fontFamily: SYSTEM_FONT,
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "400",
  },
  metaRow: { flexDirection: "row", gap: 8 },
  meta: {
    fontFamily: SYSTEM_FONT,
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "400",
  },
});
