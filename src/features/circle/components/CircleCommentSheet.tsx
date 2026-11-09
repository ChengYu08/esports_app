import { ChevronDown16Regular, Dismiss24Regular } from "@fluentui/react-native-icons";
import { Image } from "expo-image";
import { useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";

import type { CircleVideoPost } from "@/features/circle/circle-data";
import { formatCircleCount } from "@/features/circle/circle-data";
import {
  fetchCircleCommentPage,
  publishCircleComment,
  setCircleCommentLiked,
  type CircleComment,
  type CircleCommentPage,
} from "@/features/circle/circle-comments.api";
import { BottomSheet } from "@/shared/ui/BottomSheet";
import { EmptyState } from "@/shared/ui/AsyncStates";
import { CircleCommentHeartIcon } from "@/features/circle/components/CircleActionIcons";
import { showToast } from "@/shared/ui/app-toast";
import { requireLogin } from "@/shared/navigation/require-login";
import { SYSTEM_FONT } from "@/shared/theme/typography";

const atIcon = require("../../../../assets/svgs/circle-comment-at.svg");
const emojiIcon = require("../../../../assets/svgs/circle-comment-emoji.svg");
/** 未展开时最多直接展示的二级评论数，其余收进“展开回复”。 */
const VISIBLE_REPLY_COUNT = 2;

type CircleCommentSheetProps = {
  visible: boolean;
  onClose: () => void;
  post: CircleVideoPost;
  followed: boolean;
  onToggleFollow: () => void;
  token?: string;
};

type ReplyTarget = {
  comment: CircleComment;
  /** 回复二级评论时，发布需同时带父评论 id。 */
  parentCommentId?: string;
};

export function CircleCommentSheet({
  visible,
  onClose,
  post,
  followed,
  onToggleFollow,
  token,
}: CircleCommentSheetProps) {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [totalCount, setTotalCount] = useState(post.commentCount);
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const inputRef = useRef<TextInput>(null);

  const commentsQuery = useInfiniteQuery({
    queryKey: ["circle-comments", post.id, token ?? "guest"],
    enabled: visible && Boolean(token),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      fetchCircleCommentPage({ videoId: post.id, cursor: pageParam, token, signal }),
    getNextPageParam: (lastPage) =>
      lastPage.hasMore && lastPage.nextCursor ? lastPage.nextCursor : undefined,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
  const comments = useMemo(
    () => commentsQuery.data?.pages.flatMap((page) => page.list) ?? [],
    [commentsQuery.data],
  );

  const mutateComments = (updater: (list: CircleComment[]) => CircleComment[]) => {
    queryClient.setQueryData<InfiniteData<CircleCommentPage>>(
      ["circle-comments", post.id, token ?? "guest"],
      (data) => {
        if (!data) {
          return data;
        }
        return {
          ...data,
          pages: data.pages.map((page) => ({ ...page, list: updater(page.list) })),
        };
      },
    );
  };

  const updateComment = (id: string, updater: (comment: CircleComment) => CircleComment) => {
    const apply = (list: CircleComment[]): CircleComment[] =>
      list.map((comment) =>
        comment.id === id
          ? updater(comment)
          : { ...comment, replies: apply(comment.replies) },
      );
    mutateComments(apply);
  };

  const handleClose = () => {
    setReplyTarget(null);
    setInput("");
    setExpandedIds(new Set());
    setTotalCount(post.commentCount);
    onClose();
  };

  const handleLike = (comment: CircleComment) => {
    if (!requireLogin() || !token) {
      return;
    }
    const nextLiked = !comment.liked;
    // 计数与后端约定：成功后本地 ±1，接口不回传计数。
    updateComment(comment.id, (target) => ({
      ...target,
      liked: nextLiked,
      likeCount: Math.max(0, target.likeCount + (nextLiked ? 1 : -1)),
    }));
    setCircleCommentLiked({ commentId: comment.id, liked: nextLiked, token }).catch(() => {
      updateComment(comment.id, (target) => ({
        ...target,
        liked: !nextLiked,
        likeCount: Math.max(0, target.likeCount + (nextLiked ? -1 : 1)),
      }));
      showToast("点赞操作失败");
    });
  };

  const handleReplyPress = (comment: CircleComment, parentCommentId?: string) => {
    setReplyTarget({ comment, parentCommentId });
    inputRef.current?.focus();
  };

  /** 点击评论者头像跳转主页；先关弹窗收起键盘，避免返回时残留输入态。 */
  const handleOpenProfile = (comment: CircleComment) => {
    if (!comment.userId) {
      return;
    }
    handleClose();
    router.push({ pathname: "/profile", params: { userId: comment.userId } });
  };

  const handleSend = async () => {
    const content = input.trim();
    if (!content || sending) {
      return;
    }
    if (!requireLogin() || !token) {
      return;
    }
    setSending(true);
    try {
      const published = await publishCircleComment({
        videoId: post.id,
        content,
        parentCommentId: replyTarget?.parentCommentId ?? replyTarget?.comment.id,
        replyCommentId: replyTarget?.parentCommentId ? replyTarget.comment.id : undefined,
        token,
      });
      mutateComments((current) => {
        if (!replyTarget) {
          return [published, ...current];
        }
        const attach = (list: CircleComment[]): CircleComment[] =>
          list.map((comment) =>
            comment.id === (replyTarget.parentCommentId ?? replyTarget.comment.id)
              ? { ...comment, replies: [...comment.replies, published] }
              : { ...comment, replies: attach(comment.replies) },
          );
        return attach(current);
      });
      if (replyTarget) {
        // 回复展开状态同步，避免新回复被折叠入口藏住。
        setExpandedIds((current) => new Set(current).add(replyTarget.parentCommentId ?? replyTarget.comment.id));
      }
      setTotalCount((count) => count + 1);
      setInput("");
      setReplyTarget(null);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "评论发布失败");
    } finally {
      setSending(false);
    }
  };

  const toggleExpanded = (id: string) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
        return next;
      }
      next.add(id);
      return next;
    });
  };

  const nickname = useMemo(() => post.author.replace(/^@/, ""), [post.author]);

  const renderItem = ({ item }: { item: CircleComment }) => (
    <CommentRow
      comment={item}
      expanded={expandedIds.has(item.id)}
      onToggleExpanded={toggleExpanded}
      onLike={handleLike}
      onReply={handleReplyPress}
      onOpenProfile={handleOpenProfile}
    />
  );

  return (
    <BottomSheet
      visible={visible}
      onClose={handleClose}
      keyboardAvoiding
      contentStyle={styles.sheet}
    >
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Image source={post.avatar} style={styles.headerAvatar} contentFit="cover" />
          <Text style={styles.headerNickname} numberOfLines={1}>
            {nickname}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={followed ? "取消关注" : "关注作者"}
            onPress={onToggleFollow}
          >
            <Text style={[styles.followText, followed && styles.followedText]}>
              {followed ? "已关注" : "关注"}
            </Text>
          </Pressable>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="关闭评论"
          onPress={handleClose}
          style={styles.closeButton}
        >
          <Dismiss24Regular color="#333333" style={styles.closeIcon} />
        </Pressable>
      </View>

      <View style={styles.postBlock}>
        {post.headline ? <Text style={styles.postTitle}>{post.headline}</Text> : null}
        {post.content ? <Text style={styles.postContent}>{post.content}</Text> : null}
        {post.tags.length > 0 ? (
          <Text style={styles.postTags}>{post.tags.join("  ")}</Text>
        ) : null}
        <Text style={styles.postMeta}>{post.publishedAt}</Text>
      </View>

      <Text style={styles.commentCountTitle}>共 {totalCount} 条评论</Text>

      {commentsQuery.isLoading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color="#999999" />
        </View>
      ) : comments.length === 0 ? (
        <View style={styles.centerFill}>
          <EmptyState message="还没有评论，快来抢沙发吧" />
        </View>
      ) : (
        <FlatList
          data={comments}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          onEndReached={() => {
            if (
              commentsQuery.hasNextPage &&
              !commentsQuery.isFetchingNextPage &&
              !commentsQuery.isLoading
            ) {
              void commentsQuery.fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.6}
          ListFooterComponent={
            <View style={styles.listFooter}>
              {commentsQuery.isFetchingNextPage ? (
                <ActivityIndicator color="#999999" size="small" />
              ) : (
                <Text style={styles.footerText}>- 到底了 -</Text>
              )}
            </View>
          }
        />
      )}

      <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={styles.inputPill}>
          <TextInput
            ref={inputRef}
            value={input}
            onChangeText={setInput}
            placeholder={replyTarget ? `回复 ${replyTarget.comment.nickname}` : "友善评论，理性发言"}
            placeholderTextColor="#CACACC"
            style={styles.input}
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={handleSend}
          />
        </View>
        {input.trim().length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="发送评论"
            disabled={sending}
            onPress={handleSend}
          >
            <Text style={styles.sendText}>{sending ? "发送中" : "发送"}</Text>
          </Pressable>
        ) : (
          <View style={styles.inputActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="提及用户"
              onPress={() => {
                showToast("@ 功能开发中");
              }}
            >
              <Image source={atIcon} style={styles.inputIcon} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="表情"
              onPress={() => {
                showToast("表情功能开发中");
              }}
            >
              <Image source={emojiIcon} style={styles.inputIcon} />
            </Pressable>
          </View>
        )}
      </View>
    </BottomSheet>
  );
}

function CommentRow({
  comment,
  expanded,
  onToggleExpanded,
  onLike,
  onReply,
  onOpenProfile,
}: {
  comment: CircleComment;
  expanded: boolean;
  onToggleExpanded: (id: string) => void;
  onLike: (comment: CircleComment) => void;
  onReply: (comment: CircleComment, parentCommentId?: string) => void;
  onOpenProfile: (comment: CircleComment) => void;
}) {
  const hiddenReplyCount = comment.replies.length - VISIBLE_REPLY_COUNT;
  const visibleReplies = expanded
    ? comment.replies
    : comment.replies.slice(0, VISIBLE_REPLY_COUNT);

  return (
    <View style={styles.commentCard}>
      <View style={styles.commentRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`查看${comment.nickname}的主页`}
          disabled={!comment.userId}
          onPress={() => {
            onOpenProfile(comment);
          }}
        >
          <Image source={comment.avatar} style={styles.commentAvatar} contentFit="cover" />
        </Pressable>
        <View style={styles.commentBody}>
          <View style={styles.commentNameRow}>
            <Text style={styles.commentNickname} numberOfLines={1}>
              {comment.nickname}
            </Text>
            {comment.isAuthor ? (
              <View style={styles.authorTag}>
                <Text style={styles.authorTagText}>作者</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.commentContent}>
            {comment.deleted ? "该评论已删除" : comment.content}
          </Text>
          <View style={styles.commentMetaRow}>
            <View style={styles.commentMetaLeft}>
              <Text style={styles.commentMetaText}>
                {[comment.publishTime, comment.ipLocation].filter(Boolean).join(" ")}
              </Text>
              {comment.deleted ? null : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`回复${comment.nickname}的评论`}
                  onPress={() => {
                    onReply(comment);
                  }}
                >
                  <Text style={styles.replyText}>回复</Text>
                </Pressable>
              )}
            </View>
            {comment.deleted ? null : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={comment.liked ? "取消点赞评论" : "点赞评论"}
                onPress={() => {
                  onLike(comment);
                }}
                style={styles.commentLike}
              >
                <CircleCommentHeartIcon filled={comment.liked} color={comment.liked ? "#FE1F4C" : "#656566"} />
                <Text style={styles.commentLikeCount}>
                  {formatCircleCount(comment.likeCount)}
                </Text>
              </Pressable>
            )}
          </View>
          {comment.authorLiked ? (
            <View style={styles.authorLikedTag}>
              <Text style={styles.authorLikedText}>作者赞过</Text>
            </View>
          ) : null}
        </View>
      </View>

      {visibleReplies.map((reply) => (
        <ReplyRow
          key={reply.id}
          reply={reply}
          parent={comment}
          onLike={onLike}
          onReply={onReply}
          onOpenProfile={onOpenProfile}
        />
      ))}
      {hiddenReplyCount > 0 && !expanded ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`展开${hiddenReplyCount}条回复`}
          onPress={() => {
            onToggleExpanded(comment.id);
          }}
          style={styles.expandReplyRow}
        >
          <View style={styles.expandReplyLine} />
          <Text style={styles.expandReplyText}>展开 {hiddenReplyCount} 条回复</Text>
          <ChevronDown16Regular color="#7F7F80" style={styles.expandReplyIcon} />
        </Pressable>
      ) : null}
      {expanded && comment.replies.length > VISIBLE_REPLY_COUNT ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="收起回复"
          onPress={() => {
            onToggleExpanded(comment.id);
          }}
          style={styles.expandReplyRow}
        >
          <View style={styles.expandReplyLine} />
          <Text style={styles.expandReplyText}>收起回复</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function ReplyRow({
  reply,
  parent,
  onLike,
  onReply,
  onOpenProfile,
}: {
  reply: CircleComment;
  parent: CircleComment;
  onLike: (comment: CircleComment) => void;
  onReply: (comment: CircleComment, parentCommentId?: string) => void;
  onOpenProfile: (comment: CircleComment) => void;
}) {
  return (
    <View style={styles.replyRow}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`查看${reply.nickname}的主页`}
        disabled={!reply.userId}
        onPress={() => {
          onOpenProfile(reply);
        }}
      >
        <Image source={reply.avatar} style={styles.replyAvatar} contentFit="cover" />
      </Pressable>
      <View style={styles.commentBody}>
        <View style={styles.commentNameRow}>
          <Text style={styles.commentNickname} numberOfLines={1}>
            {reply.nickname}
          </Text>
          {reply.isAuthor ? (
            <View style={styles.authorTag}>
              <Text style={styles.authorTagText}>作者</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.commentContent}>
          {reply.replyNickname ? (
            <Text style={styles.replyPrefix}>
              回复 {reply.replyNickname}：
            </Text>
          ) : null}
          {reply.content}
        </Text>
        <View style={styles.commentMetaRow}>
          <View style={styles.commentMetaLeft}>
            <Text style={styles.commentMetaText}>
              {[reply.publishTime, reply.ipLocation].filter(Boolean).join(" ")}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`回复${reply.nickname}的评论`}
              onPress={() => {
                onReply(reply, parent.id);
              }}
            >
              <Text style={styles.replyText}>回复</Text>
            </Pressable>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={reply.liked ? "取消点赞回复" : "点赞回复"}
            onPress={() => {
              onLike(reply);
            }}
            style={styles.commentLike}
          >
            <CircleCommentHeartIcon filled={reply.liked} color={reply.liked ? "#FE1F4C" : "#656566"} />
            <Text style={styles.commentLikeCount}>{formatCircleCount(reply.likeCount)}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    height: "72%",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 16,
    paddingRight: 12,
    paddingTop: 12,
    paddingBottom: 12,
  },
  headerRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  headerAvatar: { width: 20, height: 20, borderRadius: 999 },
  headerNickname: {
    flexShrink: 1,
    fontFamily: SYSTEM_FONT,
    color: "#0D0D0F",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "500",
  },
  followText: {
    fontFamily: SYSTEM_FONT,
    color: "#FE1F4C",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "500",
  },
  followedText: { color: "#979799" },
  closeButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  closeIcon: { width: 20, height: 20 },
  postBlock: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#EBEBEB",
  },
  postTitle: {
    fontFamily: SYSTEM_FONT,
    color: "#0D0D0F",
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
  },
  postContent: {
    fontFamily: SYSTEM_FONT,
    color: "#0D0D0F",
    fontSize: 14,
    lineHeight: 24,
    fontWeight: "400",
  },
  postTags: {
    fontFamily: SYSTEM_FONT,
    color: "#1540AD",
    fontSize: 14,
    lineHeight: 24,
    fontWeight: "400",
  },
  postMeta: {
    fontFamily: SYSTEM_FONT,
    color: "#979799",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "400",
  },
  commentCountTitle: {
    fontFamily: SYSTEM_FONT,
    color: "#0D0D0F",
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "600",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  centerFill: { flex: 1, justifyContent: "center" },
  commentCard: { paddingVertical: 8 },
  commentRow: { flexDirection: "row", padding: 8, paddingHorizontal: 16, gap: 8 },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#EBEBEB",
  },
  commentBody: { flex: 1, gap: 6 },
  commentNameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  commentNickname: {
    flexShrink: 1,
    fontFamily: SYSTEM_FONT,
    color: "#999999",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "400",
  },
  authorTag: {
    backgroundColor: "#FFE5EB",
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  authorTagText: {
    fontFamily: SYSTEM_FONT,
    color: "#FE4267",
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "400",
  },
  commentContent: {
    fontFamily: SYSTEM_FONT,
    color: "#0D0D0F",
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "400",
  },
  commentMetaRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  commentMetaLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  commentMetaText: {
    fontFamily: SYSTEM_FONT,
    color: "#999999",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "400",
  },
  replyText: {
    fontFamily: SYSTEM_FONT,
    color: "#656566",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "400",
  },
  commentLike: { flexDirection: "row", alignItems: "center", gap: 2 },
  commentLikeCount: {
    fontFamily: SYSTEM_FONT,
    color: "#656566",
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "400",
  },
  authorLikedTag: {
    alignSelf: "flex-start",
    backgroundColor: "#F0F1F2",
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  authorLikedText: {
    fontFamily: SYSTEM_FONT,
    color: "#7F7F80",
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "400",
  },
  replyRow: { flexDirection: "row", paddingLeft: 48, paddingRight: 16, paddingVertical: 8, gap: 8 },
  replyAvatar: {
    width: 24,
    height: 24,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#EBEBEB",
  },
  replyPrefix: {
    fontFamily: SYSTEM_FONT,
    color: "#999999",
  },
  expandReplyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 8,
    paddingRight: 16,
    paddingVertical: 8,
  },
  expandReplyLine: { width: 24, height: 1, backgroundColor: "#E9E9EB", marginLeft: 8 },
  expandReplyText: {
    fontFamily: SYSTEM_FONT,
    color: "#7F7F80",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "500",
  },
  expandReplyIcon: { width: 16, height: 16 },
  listFooter: { paddingVertical: 16, alignItems: "center" },
  footerText: {
    fontFamily: SYSTEM_FONT,
    color: "#CACACC",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "400",
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 16,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E9E9EB",
    backgroundColor: "#FFFFFF",
  },
  inputPill: {
    flex: 1,
    height: 36,
    borderRadius: 999,
    backgroundColor: "#F5F6F7",
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  input: {
    fontFamily: SYSTEM_FONT,
    color: "#0D0D0F",
    fontSize: 14,
    lineHeight: 20,
    padding: 0,
  },
  inputActions: { flexDirection: "row", alignItems: "center", gap: 16 },
  inputIcon: { width: 24, height: 24 },
  sendText: {
    fontFamily: SYSTEM_FONT,
    color: "#FE1F4C",
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "600",
  },
});
