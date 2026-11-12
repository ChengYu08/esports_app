import {
  ChevronDown16Regular,
  Dismiss24Regular,
  MoreHorizontal16Regular,
} from "@fluentui/react-native-icons";
import { useAuthStore } from "@esports/auth";
import { Image } from "expo-image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { EmojiKeyboard, type EmojiType } from "rn-emoji-keyboard";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";

import type { CircleVideoPost } from "@/features/circle/circle-data";
import { formatCircleCount } from "@/features/circle/circle-data";
import {
  fetchCircleCommentPage,
  fetchCircleCommentReportTypes,
  publishCircleComment,
  reportCircleComment,
  setCircleCommentLiked,
  type CircleComment,
  type CircleCommentPage,
} from "@/features/circle/circle-comments.api";
import { useMessageStore } from "@/features/message/message-store";
import { getConversationDisplayTitle } from "@/features/message/message-title";
import {
  isSelfConversationId,
  isSystemConversationId,
} from "@/features/message/system-conversations";
import { BottomSheet } from "@/shared/ui/BottomSheet";
import { EmptyState } from "@/shared/ui/AsyncStates";
import { CircleCommentHeartIcon } from "@/features/circle/components/CircleActionIcons";
import { CircleContentText } from "@/features/circle/components/CircleContentText";
import { CircleTopicLinks } from "@/features/circle/components/CircleTopicLinks";
import { HighlightedInput } from "@/features/circle/components/HighlightedInput";
import { buildCircleContentRefs } from "@/features/circle/circle-publish-entities";
import { normalizeCircleTopicName, splitCircleTopicText } from "@/features/circle/circle-topic";
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

type CircleMentionUser = {
  id: string;
  nickname: string;
  avatar?: string;
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
  const viewerUserId = useAuthStore((state) => state.user?.id);
  const conversations = useMessageStore((state) => state.conversations);
  const blacklistedUserIds = useMessageStore((state) => state.blacklistedUserIds);
  const messageConnectionState = useMessageStore((state) => state.connectionState);
  const refreshConversations = useMessageStore((state) => state.refreshConversations);
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [focused, setFocused] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionedUsers, setMentionedUsers] = useState<CircleMentionUser[]>([]);
  /** 当前正在举报的评论；非空时展示举报弹层。 */
  const [reportTarget, setReportTarget] = useState<CircleComment | null>(null);
  const inputRef = useRef<TextInput>(null);
  const pendingProfileUserIdRef = useRef<string | null>(null);
  const handleClosed = useCallback(() => {
    const userId = pendingProfileUserIdRef.current;
    pendingProfileUserIdRef.current = null;
    if (userId) {
      requestAnimationFrame(() => {
        router.push({ pathname: "/profile", params: { userId } });
      });
    }
  }, []);

  useEffect(() => {
    const showSubscription = Keyboard.addListener("keyboardDidShow", () => {
      setKeyboardVisible(true);
    });
    const hideSubscription = Keyboard.addListener("keyboardDidHide", () => {
      setKeyboardVisible(false);
    });
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const commentsQuery = useInfiniteQuery({
    // 评论列表游客可看（后端支持免登录），仅关注/点赞/发布需要登录态
    queryKey: ["circle-comments", post.id, token ?? "guest"],
    enabled: visible,
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

  // 评论总数优先取列表接口返回的 total（MySQL 实时值，发布/删除事务内维护），
  // 未返回时回退到 feed 快照的 commentCount，避免列表加载前后头部数量跳变。
  const [localDelta, setLocalDelta] = useState(0);
  const serverTotal = commentsQuery.data?.pages[0]?.total;
  const totalCount =
    (serverTotal ?? post.commentCount) + localDelta;

  const mentionUsers = useMemo<CircleMentionUser[]>(
    () =>
      conversations
        .filter(
          (conversation) =>
            !isSystemConversationId(conversation.id) &&
            !isSelfConversationId(conversation.id, viewerUserId) &&
            !blacklistedUserIds.includes(conversation.id),
        )
        .map((conversation) => ({
          id: conversation.id,
          nickname: getConversationDisplayTitle(
            conversation.id,
            conversation.title,
            conversation.note,
          ),
          avatar: conversation.avatar,
        })),
    [blacklistedUserIds, conversations, viewerUserId],
  );

  /** 输入框高亮用：id→昵称 字典，命中草稿里真实出现的 @昵称。 */
  const mentionNameDict = useMemo<Record<string, string>>(
    () =>
      Object.fromEntries(
        mentionedUsers
          .filter((user) => user.nickname)
          .map((user) => [user.id, user.nickname]),
      ),
    [mentionedUsers],
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
    Keyboard.dismiss();
    setReplyTarget(null);
    setInput("");
    setFocused(false);
    setKeyboardVisible(false);
    setEmojiPickerOpen(false);
    setMentionOpen(false);
    setMentionedUsers([]);
    setExpandedIds(new Set());
    setLocalDelta(0);
    setReportTarget(null);
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
    setEmojiPickerOpen(false);
    setMentionOpen(false);
    inputRef.current?.focus();
  };

  const handleMentionPress = () => {
    if (!requireLogin() || !token) {
      return;
    }
    // 已聚焦时点 @ 保持焦点与键盘（@ 面板在输入框上方，不与键盘重叠）；
    // 未聚焦时只展开 @ 面板、不拉起键盘，否则面板首击会被“收起键盘”吞掉。
    const keepKeyboard = focused && !emojiPickerOpen;
    setEmojiPickerOpen(false);
    setFocused(true);
    setMentionOpen(true);
    setInput((current) => (current.endsWith("@") ? current : `${current}@`));
    if (keepKeyboard) {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
    void refreshConversations(token);
  };

  const handleMentionSelect = (user: CircleMentionUser) => {
    setMentionedUsers((current) => {
      if (current.some((item) => item.id === user.id)) {
        return current;
      }
      return [...current, user];
    });
    setInput((current) => {
      const prefix = current.endsWith("@") ? current : `${current}@`;
      return `${prefix}${user.nickname} `;
    });
    setMentionOpen(false);
    inputRef.current?.focus();
  };

  // 与聊天输入一致：选中表情只追加草稿，面板保持展开，便于连续选择。
  const handleEmojiSelect = useCallback((emoji: EmojiType) => {
    setInput((current) => {
      if (current.length + emoji.emoji.length > 500) {
        return current;
      }
      return `${current}${emoji.emoji}`;
    });
  }, []);

  const handleEmojiPress = () => {
    setMentionOpen(false);
    if (emojiPickerOpen) {
      setEmojiPickerOpen(false);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
      return;
    }
    // 已聚焦时点表情保持焦点与键盘；未聚焦时只展开表情面板、不拉起键盘。
    setFocused(true);
    setEmojiPickerOpen(true);
    if (!focused) {
      Keyboard.dismiss();
    }
  };

  /** 点击评论者头像跳转主页；先关弹窗收起键盘，避免返回时残留输入态。 */
  const handleOpenProfile = (comment: CircleComment) => {
    if (!comment.userId) {
      return;
    }
    pendingProfileUserIdRef.current = comment.userId;
    handleClose();
  };

  /** 点三个点打开举报弹层，与点赞一致需要登录态。 */
  const handleOpenReport = (comment: CircleComment) => {
    if (comment.deleted) {
      return;
    }
    if (!requireLogin() || !token) {
      return;
    }
    setReplyTarget(null);
    setEmojiPickerOpen(false);
    setMentionOpen(false);
    setReportTarget(comment);
  };

  const handleSend = async () => {
    const content = input.trim();
    if (!content || sending) {
      return;
    }
    if (!requireLogin() || !token) {
      return;
    }
    // 点击发送立即收起键盘，不等发布请求返回（否则键盘要等网络往返结束才关）。
    Keyboard.dismiss();
    setSending(true);
    try {
      const published = await publishCircleComment({
        videoId: post.id,
        content,
        parentCommentId: replyTarget?.parentCommentId ?? replyTarget?.comment.id,
        replyCommentId: replyTarget?.parentCommentId ? replyTarget.comment.id : undefined,
        mentionUserIds: mentionedUsers.map((user) => user.id),
        mentions: buildCircleContentRefs(
          content,
          mentionedUsers.map((user) => ({ id: user.id, label: user.nickname })),
          "@",
        ),
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
      setLocalDelta((count) => count + 1);
      setInput("");
      setReplyTarget(null);
      setMentionOpen(false);
      setMentionedUsers([]);
      setEmojiPickerOpen(false);
      setFocused(false);
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
  const inputActive = focused || emojiPickerOpen;
  const contentTopics = new Set(splitCircleTopicText(post.content).flatMap((segment) => segment.topic ? [segment.topic] : []));
  const extraTags = post.tags.filter((tag) => !contentTopics.has(normalizeCircleTopicName(tag)));

  const renderItem = ({ item }: { item: CircleComment }) => (
    <CommentRow
      comment={item}
      expanded={expandedIds.has(item.id)}
      onToggleExpanded={toggleExpanded}
      onLike={handleLike}
      onReply={handleReplyPress}
      onOpenProfile={handleOpenProfile}
      onOpenReport={handleOpenReport}
      onOpenTopic={handleClose}
    />
  );

  return (
    <BottomSheet
      visible={visible}
      onClose={handleClose}
      onClosed={handleClosed}
      onRequestClose={() => {
        if (emojiPickerOpen) {
          setEmojiPickerOpen(false);
          return;
        }
        handleClose();
      }}
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

      <FlatList
        data={comments}
        style={styles.commentList}
        keyboardShouldPersistTaps="handled"
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={
          <>
            {/* 帖子正文必须属于同一个滚动容器，超长正文不能挤掉评论列表的可视高度。 */}
            <View style={styles.postBlock}>
              {post.headline ? <Text style={styles.postTitle}>{post.headline}</Text> : null}
              {post.content ? (
                <CircleContentText
                  content={post.content}
                  style={styles.postContent}
                  linkStyle={styles.postTags}
                  mentionStyle={styles.postTags}
                  mentions={post.mentions}
                  onBeforeNavigate={handleClose}
                />
              ) : null}
              {extraTags.length > 0 ? (
                <CircleTopicLinks
                  tags={extraTags}
                  separator="  "
                  style={styles.postTags}
                  onBeforeNavigate={handleClose}
                />
              ) : null}
              <Text style={styles.postMeta}>{post.publishedAt}</Text>
            </View>
            <Text style={styles.commentCountTitle}>共 {totalCount} 条评论</Text>
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            {commentsQuery.isLoading ? (
              <ActivityIndicator color="#999999" />
            ) : (
              <EmptyState message="还没有评论，快来抢沙发吧" />
            )}
          </View>
        }
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
          comments.length > 0 ? (
            <View style={styles.listFooter}>
              {commentsQuery.isFetchingNextPage ? (
                <ActivityIndicator color="#999999" size="small" />
              ) : (
                <Text style={styles.footerText}>- 到底了 -</Text>
              )}
            </View>
          ) : null
        }
      />

      <View
        style={[
          styles.inputBar,
          inputActive && styles.inputBarFocused,
          {
            paddingBottom: emojiPickerOpen || keyboardVisible ? 12 : Math.max(insets.bottom, 12),
          },
        ]}
      >
        {inputActive && mentionOpen ? (
          <MentionUserList
            users={mentionUsers}
            loading={
              messageConnectionState === "idle" || messageConnectionState === "connecting"
            }
            onSelect={handleMentionSelect}
          />
        ) : null}
        {/* 聚焦/失焦共用同一个 TextInput，仅切换容器样式，避免重新挂载导致键盘收起 */}
        <View style={inputActive ? styles.inputTextArea : styles.inputPill}>
          <HighlightedInput
            ref={inputRef}
            value={input}
            onChangeText={(value) => {
              setInput(value);
              setMentionedUsers((current) =>
                current.filter((user) => value.includes(`@${user.nickname}`)),
              );
              if (!value.includes("@")) {
                setMentionOpen(false);
              }
            }}
            placeholder={replyTarget ? `回复 ${replyTarget.comment.nickname}` : "友善评论，理性发言"}
            placeholderTextColor="#CACACC"
            style={inputActive ? styles.inputExpanded : styles.input}
            containerStyle={inputActive ? styles.inputHighlightContainerActive : styles.inputHighlightContainer}
            highlightStyle={styles.inputHighlight}
            mentions={mentionNameDict}
            maxLength={500}
            multiline
            blurOnSubmit
            returnKeyType="send"
            onSubmitEditing={handleSend}
            onFocus={() => {
              setEmojiPickerOpen(false);
              setFocused(true);
            }}
          />
          {inputActive ? null : (
            <CommentInputActions
              style={styles.inputActions}
              onMention={handleMentionPress}
              onEmoji={handleEmojiPress}
            />
          )}
        </View>
        {inputActive ? (
          <View style={styles.inputToolbar}>
            <CommentInputActions
              style={styles.inputToolbarIcons}
              onMention={handleMentionPress}
              onEmoji={handleEmojiPress}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="发送评论"
              disabled={!input.trim() || sending}
              onPressIn={handleSend}
              style={({ pressed }) => [
                styles.sendButtonSmall,
                (!input.trim() || sending) && styles.sendButtonDisabled,
                pressed && styles.sendButtonPressed,
              ]}
            >
              <Text style={styles.sendButtonSmallText}>{sending ? "发送中" : "发送"}</Text>
            </Pressable>
          </View>
        ) : input.trim().length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="发送评论"
            disabled={sending}
            onPressIn={handleSend}
            style={({ pressed }) => [styles.sendButton, pressed && styles.sendButtonPressed]}
          >
            <Text style={styles.sendButtonText}>{sending ? "发送中" : "发送"}</Text>
          </Pressable>
        ) : null}
      </View>
      {emojiPickerOpen ? (
        <View style={[styles.emojiPanel, { height: 340 + insets.bottom + 10 }]}>
          <EmojiKeyboard
            categoryPosition="bottom"
            disableSafeArea
            enableRecentlyUsed
            hideHeader
            onEmojiSelected={handleEmojiSelect}
            styles={{
              container: {
                paddingBottom: insets.bottom + 10,
                borderRadius: 0,
                elevation: 0,
                shadowOpacity: 0,
              },
            }}
            theme={{
              container: "#FFFFFF",
              header: "#333333",
              category: { icon: "#999999", iconActive: "#FE1F4C" },
            }}
          />
        </View>
      ) : null}
      {reportTarget ? (
        <CommentReportSheet
          key={reportTarget.id}
          comment={reportTarget}
          token={token ?? ""}
          onClose={() => {
            setReportTarget(null);
          }}
        />
      ) : null}
    </BottomSheet>
  );
}

/** 评论举报弹层：类型枚举动态下发（对齐 PC ReportDialog）+ 选填补充说明。 */
function CommentReportSheet({
  comment,
  token,
  onClose,
}: {
  comment: CircleComment;
  token: string;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(true);
  const [selected, setSelected] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const reportTypesQuery = useQuery({
    queryKey: ["circle-comment-report-types"],
    queryFn: ({ signal }) => fetchCircleCommentReportTypes(signal),
    staleTime: 5 * 60_000,
  });
  const reportTypes = reportTypesQuery.data ?? [];
  /** 退场动画播完后才卸载，交给父级清理目标评论。 */
  const close = () => {
    setVisible(false);
  };

  const handleSubmit = async () => {
    if (!selected) {
      showToast("请选择举报类型");
      return;
    }
    if (submitting) {
      return;
    }
    setSubmitting(true);
    try {
      await reportCircleComment({
        commentId: comment.id,
        reportType: selected,
        reportDesc: description,
        token,
      });
      showToast("举报成功，我们将尽快处理");
      close();
    } catch (error) {
      setSubmitting(false);
      showToast(error instanceof Error ? error.message : "举报提交失败");
    }
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={close}
      onClosed={onClose}
      keyboardAvoiding
      scrollable
      contentStyle={styles.reportSheet}
    >
      <View style={styles.reportHeader}>
        <Text style={styles.reportTitle}>举报评论</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="关闭举报"
          onPress={close}
          style={styles.closeButton}
        >
          <Dismiss24Regular color="#333333" style={styles.closeIcon} />
        </Pressable>
      </View>
      <Text style={styles.reportHint}>请选择举报类型</Text>
      {reportTypesQuery.isLoading ? (
        <ActivityIndicator color="#999999" style={styles.reportLoading} />
      ) : (
        <View style={styles.reportTypes}>
          {reportTypes.map((type) => {
            const active = selected === type.code;
            return (
              <Pressable
                key={type.code}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                accessibilityLabel={type.name}
                disabled={submitting}
                onPress={() => {
                  setSelected(type.code);
                }}
                style={[styles.reportType, active && styles.reportTypeActive]}
              >
                <Text style={[styles.reportTypeText, active && styles.reportTypeTextActive]}>
                  {type.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
      <TextInput
        accessibilityLabel="举报补充说明"
        editable={!submitting}
        maxLength={200}
        multiline
        onChangeText={setDescription}
        placeholder="补充说明（选填，最多200字）"
        placeholderTextColor="#CACACC"
        style={styles.reportDescInput}
        textAlignVertical="top"
        cursorColor="#FE1F4C"
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="提交举报"
        disabled={submitting}
        onPress={handleSubmit}
        style={({ pressed }) => [
          styles.reportSubmit,
          submitting && styles.reportSubmitDisabled,
          pressed && !submitting && styles.reportSubmitPressed,
        ]}
      >
        <Text style={styles.reportSubmitText}>{submitting ? "提交中" : "提交"}</Text>
      </Pressable>
      <View style={{ height: Math.max(insets.bottom, 16) }} />
    </BottomSheet>
  );
}

/** 输入栏右侧的 @ / 表情图标组，胶囊内与聚焦工具行共用。 */
function CommentInputActions({
  style,
  onMention,
  onEmoji,
}: {
  style?: StyleProp<ViewStyle>;
  onMention: () => void;
  onEmoji: () => void;
}) {
  return (
    <View style={style}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="提及用户"
        onPress={onMention}
      >
        <Image source={atIcon} style={styles.inputIcon} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="表情"
        onPress={onEmoji}
      >
        <Image source={emojiIcon} style={styles.inputIcon} />
      </Pressable>
    </View>
  );
}

function MentionUserList({
  users,
  loading,
  onSelect,
}: {
  users: CircleMentionUser[];
  loading: boolean;
  onSelect: (user: CircleMentionUser) => void;
}) {
  return (
    <View style={styles.mentionRow}>
      {loading && users.length === 0 ? (
        <ActivityIndicator color="#999999" size="small" style={styles.mentionLoading} />
      ) : users.length === 0 ? (
        <Text style={styles.mentionEmpty}>暂无可@用户</Text>
      ) : (
        <ScrollView
          horizontal
          keyboardShouldPersistTaps="always"
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.mentionContent}
        >
          {users.map((user) => (
            <Pressable
              key={user.id}
              accessibilityRole="button"
              accessibilityLabel={`@${user.nickname}`}
              onPress={() => {
                onSelect(user);
              }}
              style={({ pressed }) => [styles.mentionUser, pressed && styles.mentionUserPressed]}
            >
              <View style={styles.mentionAvatar}>
                {user.avatar ? (
                  <Image source={{ uri: user.avatar }} style={styles.mentionAvatarImage} contentFit="cover" />
                ) : (
                  <Text style={styles.mentionAvatarFallback}>{user.nickname.slice(0, 1)}</Text>
                )}
              </View>
              <Text numberOfLines={1} style={styles.mentionNickname}>
                {user.nickname}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

/** 一级评论与二级评论共用的三个点入口，点击打开举报弹层；已删除评论不展示。 */
function CommentMoreButton({
  comment,
  onOpenReport,
}: {
  comment: CircleComment;
  onOpenReport: (comment: CircleComment) => void;
}) {
  if (comment.deleted) {
    return null;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`举报${comment.nickname}的评论`}
      hitSlop={8}
      onPress={() => {
        onOpenReport(comment);
      }}
      style={styles.commentMore}
    >
      <MoreHorizontal16Regular color="#999999" style={styles.commentMoreIcon} />
    </Pressable>
  );
}

function CommentRow({
  comment,
  expanded,
  onToggleExpanded,
  onLike,
  onReply,
  onOpenProfile,
  onOpenReport,
  onOpenTopic,
}: {
  comment: CircleComment;
  expanded: boolean;
  onToggleExpanded: (id: string) => void;
  onLike: (comment: CircleComment) => void;
  onReply: (comment: CircleComment, parentCommentId?: string) => void;
  onOpenProfile: (comment: CircleComment) => void;
  onOpenReport: (comment: CircleComment) => void;
  onOpenTopic: () => void;
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
            <CommentMoreButton comment={comment} onOpenReport={onOpenReport} />
          </View>
          <Text style={styles.commentContent}>
            {comment.deleted ? "该评论已删除" : (
              <CircleContentText
                content={comment.content}
                linkStyle={styles.postTags}
                mentionStyle={styles.postTags}
                mentions={comment.mentions}
                onBeforeNavigate={onOpenTopic}
              />
            )}
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
          onOpenReport={onOpenReport}
          onOpenTopic={onOpenTopic}
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
  onOpenReport,
  onOpenTopic,
}: {
  reply: CircleComment;
  parent: CircleComment;
  onLike: (comment: CircleComment) => void;
  onReply: (comment: CircleComment, parentCommentId?: string) => void;
  onOpenProfile: (comment: CircleComment) => void;
  onOpenReport: (comment: CircleComment) => void;
  onOpenTopic: () => void;
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
          <CommentMoreButton comment={reply} onOpenReport={onOpenReport} />
        </View>
        <Text style={styles.commentContent}>
          {reply.replyNickname ? (
            <Text style={styles.replyPrefix}>
              回复 {reply.replyNickname}：
            </Text>
          ) : null}
          <CircleContentText
            content={reply.content}
            linkStyle={styles.postTags}
            mentionStyle={styles.postTags}
            mentions={reply.mentions}
            onBeforeNavigate={onOpenTopic}
          />
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
  emptyState: { minHeight: 160, justifyContent: "center" },
  // 列表必须 flex:1 吸收弹窗高度压缩（键盘抬起时 72% 高度骤减），
  // 否则内容把输入栏挤出弹窗底边、被键盘盖住
  commentList: { flex: 1 },
  emojiPanel: {
    flexShrink: 0,
    backgroundColor: "#FFFFFF",
  },
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
  commentMore: {
    marginLeft: "auto",
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  commentMoreIcon: { width: 16, height: 16 },
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
  inputBarFocused: {
    flexDirection: "column",
    alignItems: "stretch",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  mentionRow: {
    minHeight: 50,
    marginHorizontal: -12,
    marginTop: -12,
    paddingTop: 12,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    backgroundColor: "#FFFFFF",
  },
  mentionContent: { paddingHorizontal: 12, gap: 12 },
  mentionLoading: { marginLeft: 12, alignSelf: "center" },
  mentionEmpty: {
    marginLeft: 12,
    color: "#999999",
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    lineHeight: 32,
  },
  mentionUser: { width: 56, alignItems: "center", gap: 2 },
  mentionUserPressed: { opacity: 0.7 },
  mentionAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F0F1F2",
  },
  mentionAvatarImage: { width: "100%", height: "100%" },
  mentionAvatarFallback: {
    color: "#7F7F80",
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
  },
  mentionNickname: {
    width: "100%",
    color: "#333333",
    fontFamily: SYSTEM_FONT,
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
  },
  inputPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    minHeight: 36,
    borderRadius: 999,
    backgroundColor: "#F5F6F7",
    paddingHorizontal: 12,
    paddingVertical: 4,
    gap: 12,
  },
  inputHighlightContainer: {
    flex: 1,
    justifyContent: "flex-start",
  },
  inputHighlightContainerActive: {
    flex: 1,
    justifyContent: "flex-start",
  },
  input: {
    fontFamily: SYSTEM_FONT,
    color: "#0D0D0F",
    fontSize: 14,
    lineHeight: 22,
    padding: 0,
  },
  inputHighlight: {
    color: "#1540AD",
  },
  inputTextArea: {
    minHeight: 60,
    borderRadius: 8,
    backgroundColor: "#F7F7F7",
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
  },
  inputExpanded: {
    fontFamily: SYSTEM_FONT,
    color: "#0D0D0F",
    fontSize: 14,
    lineHeight: 22,
    minHeight: 40,
    padding: 0,
    textAlignVertical: "top",
  },
  inputActions: { flexDirection: "row", alignItems: "center", gap: 16 },
  inputToolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 24,
  },
  inputToolbarIcons: { flexDirection: "row", alignItems: "center", gap: 24 },
  inputIcon: { width: 24, height: 24 },
  reportSheet: {
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    maxHeight: "70%",
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  reportHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 12,
  },
  reportTitle: {
    flex: 1,
    fontFamily: SYSTEM_FONT,
    color: "#0D0D0F",
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
    textAlign: "center",
  },
  reportHint: {
    fontFamily: SYSTEM_FONT,
    color: "#656566",
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "400",
    paddingBottom: 12,
  },
  reportLoading: { marginVertical: 24 },
  reportTypes: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingBottom: 4,
  },
  reportType: {
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#EBEBEB",
    backgroundColor: "#F5F6F7",
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  reportTypeActive: {
    borderColor: "#FE1F4C",
    backgroundColor: "#FFE5EB",
  },
  reportTypeText: {
    fontFamily: SYSTEM_FONT,
    color: "#0D0D0F",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "400",
  },
  reportTypeTextActive: {
    color: "#FE1F4C",
    fontWeight: "500",
  },
  reportDescInput: {
    borderRadius: 8,
    backgroundColor: "#F7F7F7",
    color: "#0D0D0F",
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    lineHeight: 22,
    minHeight: 88,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  reportSubmit: {
    height: 44,
    borderRadius: 999,
    backgroundColor: "#FE1F4C",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  reportSubmitDisabled: { opacity: 0.5 },
  reportSubmitPressed: { opacity: 0.82 },
  reportSubmitText: {
    fontFamily: SYSTEM_FONT,
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "500",
  },
  sendButton: {
    height: 36,
    borderRadius: 999,
    backgroundColor: "#FE1F4C",
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonText: {
    fontFamily: SYSTEM_FONT,
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "500",
  },
  sendButtonSmall: {
    minHeight: 26,
    borderRadius: 999,
    backgroundColor: "#FE1F4C",
    paddingHorizontal: 12,
    paddingVertical: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonSmallText: {
    fontFamily: SYSTEM_FONT,
    color: "#FFFFFF",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "500",
  },
  sendButtonDisabled: { opacity: 0.5 },
  sendButtonPressed: { opacity: 0.8 },
});
