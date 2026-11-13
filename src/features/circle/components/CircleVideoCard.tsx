import { requireLogin } from "@/shared/navigation/require-login";
import { useAuthStore } from "@esports/auth";
import { Add16Filled } from "@fluentui/react-native-icons";
import { useRecyclingState } from "@shopify/flash-list";
import { useMutation } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextLayoutEvent,
  View,
} from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import {
  formatCircleCount,
  type CircleVideoPost,
} from "@/features/circle/circle-data";
import { usePooledCirclePlayer } from "@/features/circle/circle-player-pool";
import {
  normalizeCircleTopicName,
  splitCircleTopicText,
} from "@/features/circle/circle-topic";
import {
  setCircleAuthorFollowed,
  setCircleVideoLiked,
} from "@/features/circle/circle.api";
import {
  CircleCommentIcon,
  CircleHeartIcon,
  CircleMoreIcon,
} from "@/features/circle/components/CircleActionIcons";
import { CircleCommentSheet } from "@/features/circle/components/CircleCommentSheet";
import { CircleContentText } from "@/features/circle/components/CircleContentText";
import { CircleMoreActionsSheet } from "@/features/circle/components/CircleMoreActionsSheet";
import { CircleVideoPlayer } from "@/features/circle/components/CircleVideoPlayer";
import { CircleVideoProgressBar } from "@/features/circle/components/CircleVideoProgressBar";
import { addToBlacklist } from "@/features/mine/blacklist";
import { SYSTEM_FONT } from "@/shared/theme/typography";
import { AppPrompt } from "@/shared/ui/AppPrompt";
import { showToast } from "@/shared/ui/app-toast";

/** 底部信息区的大致占位高度，右侧操作栏以此为基准向上排布。 */
const BOTTOM_INFO_HEIGHT = 90;
/** 与 AppTabBar 一致的内容区高度。 */
const TAB_CONTENT_HEIGHT = 58;
/** 自主声明中表示「无声明」的占位项，正文区不展示。 */
const NO_DECLARATION = "无需添加自主声明";

type CircleVideoCardProps = {
  /** 所属 feed 标识，用于全局播放器池的焦点仲裁。 */
  feedId: string;
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
  onBlockSuccess?: () => void;
};

export function CircleVideoCard({
  feedId,
  post,
  bottomInset,
  height,
  active,
  playing,
  onPlaybackChange,
  shouldPreload,
  shouldRetain,
  onBlockSuccess,
}: CircleVideoCardProps) {
  const token = useAuthStore((state) => state.accessToken);
  const currentUserId = useAuthStore((state) => state.user?.id);
  // 自己的作品：不展示关注按钮与更多操作（举报/拉黑对自己无意义）
  const isOwnPost = Boolean(post.authorId) && String(currentUserId ?? "") === post.authorId;
  const [liked, setLiked] = useRecyclingState(post.liked ?? false, [
    post.id,
    post.liked,
  ]);
  const [followed, setFollowed] = useRecyclingState(post.followed ?? false, [
    post.id,
    post.followed,
  ]);
  const [expanded, setExpanded] = useRecyclingState(false, [post.id]);
  const [needsExpand, setNeedsExpand] = useRecyclingState(false, [post.id]);
  const [commentSheetVisible, setCommentSheetVisible] = useRecyclingState(
    false,
    [post.id],
  );
  const [moreActionsVisible, setMoreActionsVisible] = useRecyclingState(false, [
    post.id,
  ]);
  const pendingActionRef = useRef<{
    kind: "report" | "block";
    authorId?: string;
    author: string;
  } | null>(null);
  const [blockTarget, setBlockTarget] = useRecyclingState<{
    userId: string;
    nickname: string;
  } | null>(null, [post.id]);
  const blockingRef = useRef(false);
  const [playError, setPlayError] = useRecyclingState(false, [post.id, active]);
  const [playerAttempt, setPlayerAttempt] = useRecyclingState(0, [post.id]);
  const [scrubbing, setScrubbing] = useRecyclingState(false, [post.id, active]);
  const { slot: poolSlot, player: poolPlayer } = usePooledCirclePlayer({
    feedId,
    post,
    inWindow:
      Boolean(post.videoUrl) && (active || shouldPreload || shouldRetain),
    preload: shouldPreload,
    forceReload: playerAttempt,
  });
  const coverOpacity = useSharedValue(1);
  const frameReadyRef = useRef(false);
  const coverAnimatedStyle = useAnimatedStyle(() => ({
    opacity: coverOpacity.get(),
  }));
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
  const progressBottom = TAB_CONTENT_HEIGHT + bottomInset - 8;
  const contentTopics = new Set(
    splitCircleTopicText(post.content).flatMap((segment) =>
      segment.topic ? [segment.topic] : [],
    ),
  );
  const extraTags = post.tags.filter(
    (tag) => !contentTopics.has(normalizeCircleTopicName(tag)),
  );
  const declarationText = (post.declaration ?? [])
    .filter((item) => item && item !== NO_DECLARATION)
    .join("、");

  // 仅换视频或换播放器时恢复封面，等待当前视频首帧确认后再淡出。
  useLayoutEffect(() => {
    frameReadyRef.current = false;
    cancelAnimation(coverOpacity);
    coverOpacity.set(1);
  }, [coverOpacity, playerAttempt, poolSlot, post.id]);

  useEffect(() => {
    if (!active && !shouldPreload && !shouldRetain) {
      frameReadyRef.current = false;
      cancelAnimation(coverOpacity);
      coverOpacity.set(1);
    } else if (active && frameReadyRef.current) {
      coverOpacity.set(withTiming(0, { duration: 180 }));
    }
  }, [
    active,
    coverOpacity,
    playerAttempt,
    post.id,
    shouldPreload,
    shouldRetain,
  ]);

  const handlePlayerReady = useCallback(() => {
    frameReadyRef.current = true;
    setPlayError(false);
    if (active) {
      coverOpacity.set(withTiming(0, { duration: 180 }));
    }
  }, [active, coverOpacity, setPlayError]);
  const handlePlayerError = useCallback(() => {
    frameReadyRef.current = false;
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
    // 弹窗是 Modal 覆盖层，不改变卡片尺寸；跳过父列表重排，避免上滑动画起始帧与整树布局抢主线程导致卡顿
    setCommentSheetVisible(true, true);
  };
  const handleMoreActions = () => {
    setMoreActionsVisible(true, true);
  };
  const handleReport = () => {
    pendingActionRef.current = {
      kind: "report",
      authorId: post.authorId,
      author: post.author,
    };
    setMoreActionsVisible(false, true);
  };
  const handleBlock = () => {
    pendingActionRef.current = {
      kind: "block",
      authorId: post.authorId,
      author: post.author,
    };
    setMoreActionsVisible(false, true);
  };
  const handleMoreActionsExited = () => {
    const target = pendingActionRef.current;
    pendingActionRef.current = null;
    if (!target) {
      return;
    }
    if (!requireLogin()) {
      return;
    }
    if (!target.authorId) {
      showToast("缺少操作对象");
      return;
    }
    if (target.kind === "block") {
      if (String(currentUserId ?? "") === target.authorId) {
        showToast("不能拉黑自己");
        return;
      }
      setBlockTarget({ userId: target.authorId, nickname: target.author });
      return;
    }
    router.push({
      pathname: "/report",
      params: { userId: target.authorId, nickname: target.author },
    });
  };
  const handleConfirmBlock = () => {
    if (!blockTarget || blockingRef.current) {
      return;
    }
    const target = blockTarget;
    const currentToken = useAuthStore.getState().accessToken;
    if (!currentToken) {
      setBlockTarget(null);
      requireLogin();
      return;
    }
    blockingRef.current = true;
    setBlockTarget(null);
    requestAnimationFrame(() => {
      addToBlacklist(target, currentToken)
        .then(() => {
          onBlockSuccess?.();
          showToast("已拉黑该用户");
        })
        .catch((error: unknown) => {
          showToast(error instanceof Error ? error.message : "拉黑失败");
        })
        .finally(() => {
          blockingRef.current = false;
        });
    });
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
      {poolPlayer && poolSlot !== null ? (
        <CircleVideoPlayer
          key={`${post.id}:${poolSlot}:${playerAttempt}`}
          player={poolPlayer}
          slot={poolSlot}
          post={post}
          active={active}
          shouldPlay={active && playing}
          token={token ?? undefined}
          onFirstFrame={handlePlayerReady}
          onError={handlePlayerError}
        />
      ) : null}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          styles.coverOverlay,
          coverAnimatedStyle,
        ]}
      >
        <Image
          source={post.cover}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
        />
      </Animated.View>
      {active ? (
        <Pressable
          accessibilityLabel={playing ? "暂停视频" : "播放视频"}
          disabled={scrubbing}
          onPress={handlePlay}
          style={styles.playButton}
        >
          {playError ? (
            <Text style={styles.retryText}>播放失败，点击重试</Text>
          ) : !playing || scrubbing ? (
            <Image
              source={require("../../../../assets/svgs/circle-play.svg")}
              style={styles.playIcon}
            />
          ) : null}
        </Pressable>
      ) : null}

      {!scrubbing ? <View style={[styles.actionBar, { bottom: actionBarBottom }]}>
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
              router.push({
                pathname: "/profile",
                params: { userId: post.authorId },
              });
            }}
          >
            <Image
              source={post.avatar}
              style={styles.avatar}
              contentFit="cover"
            />
          </Pressable>
          {!followed && !isOwnPost ? (
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
        <Pressable
          accessibilityLabel="点赞"
          style={styles.actionItem}
          onPress={handleLike}
        >
          <CircleHeartIcon color={liked ? "#FE4267" : "#FFFFFF"} />
          <Text style={styles.actionCount}>
            {formatCircleCount(post.likeCount + (liked ? 1 : 0))}
          </Text>
        </Pressable>
        <Pressable
          accessibilityLabel="评论"
          style={styles.actionItem}
          onPress={handleComment}
        >
          <CircleCommentIcon color="#FFFFFF" />
          <Text style={styles.actionCount}>
            {formatCircleCount(post.commentCount)}
          </Text>
        </Pressable>
        {!isOwnPost ? (
          <Pressable
            accessibilityLabel="更多操作"
            accessibilityRole="button"
            style={styles.actionItem}
            onPress={handleMoreActions}
          >
            <CircleMoreIcon color="#FFFFFF" />
            <Text style={styles.actionCount}>更多</Text>
          </Pressable>
        ) : null}
      </View> : null}

      <LinearGradient
        colors={["rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 0.7)"]}
        style={[styles.bottomGradient, { paddingBottom: bottomPadding }]}
        pointerEvents="none"
      />
      {!scrubbing ? <View style={[styles.bottomInfo, { paddingBottom: bottomPadding }]}>
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
          {post.headline ? (
            <Text style={styles.headline}>{post.headline}</Text>
          ) : null}
          <View style={styles.contentRow}>
            <View
              style={[
                styles.contentContainer,
                needsExpand && !expanded && styles.collapsedContent,
              ]}
            >
              <CircleContentText
                content={post.content}
                style={styles.content}
                linkStyle={styles.tags}
                mentionStyle={styles.mention}
                mentions={post.mentions}
                tags={extraTags}
              />
            </View>
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
            <View pointerEvents="none" style={styles.contentMeasure}>
              <Text onTextLayout={handleContentMeasure} style={styles.content}>
                {post.content}
                <Text style={styles.tags}> {extraTags.join(" ")}</Text>
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>{post.publishedAt}</Text>
          {declarationText ? (
            <Text style={styles.meta}>作者声明：{declarationText}</Text>
          ) : null}
        </View>
      </View> : null}

      {active && !playing && poolPlayer && poolSlot !== null && post.videoUrl ? (
        <CircleVideoProgressBar
          key={`${post.id}:${poolSlot}`}
          player={poolPlayer}
          slot={poolSlot}
          postId={post.id}
          videoUrl={post.videoUrl}
          active={active}
          playing={playing}
          bottom={progressBottom}
          onScrubbingChange={setScrubbing}
        />
      ) : null}

      <CircleCommentSheet
        visible={commentSheetVisible}
        onClose={() => {
          setCommentSheetVisible(false, true);
        }}
        post={post}
        followed={followed}
        onToggleFollow={handleFollow}
        token={token ?? undefined}
      />
      <CircleMoreActionsSheet
        visible={moreActionsVisible}
        onClose={() => {
          setMoreActionsVisible(false, true);
        }}
        onExited={handleMoreActionsExited}
        onReport={handleReport}
        onBlock={handleBlock}
      />
      {blockTarget ? (
        <AppPrompt
          visible
          title="拉黑提示"
          message="拉黑后，您将看不到该用户的盼友圈视频，也无法收到对方的私信或互相下单。"
          cancelText="取消"
          confirmText="确认拉黑"
          onCancel={() => {
            setBlockTarget(null);
          }}
          onConfirm={handleConfirmBlock}
        />
      ) : null}
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
  contentContainer: { flex: 1 },
  content: {
    fontFamily: SYSTEM_FONT,
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "400",
  },
  // 收起态用固定两行高度 + overflow 裁剪，替代 numberOfLines（后者会让嵌套话题/用户的 onPress 失效）。
  collapsedContent: { height: 44, overflow: "hidden" },
  tags: { color: "#99B6FF" },
  // 深色视频背景上 @用户 用金色高亮（对齐 PC），与浅蓝话题区分且可读。
  mention: { color: "#FFD04D", fontWeight: "500" },
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
