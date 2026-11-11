import { EmptyState } from "@/shared/ui/AsyncStates";
import { useAuthStore } from "@esports/auth";
import { Image } from "expo-image";
import { router, useFocusEffect, useIsFocused } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo } from "react";
import { AppState, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { layout } from "@/shared/theme/tokens";
import { stripCustomerServiceTitlePrefix } from "../customer-service.api";
import { MessageHeader } from "../components/MessageHeader";
import { MessageListItem } from "../components/MessageListItem";
import type { MessageConversation } from "../message-state";
import {
  getConversationAvatarUri,
  resolveConversationAvatar,
} from "../message-avatar";
import { useMessageStore } from "../message-store";
import {
  ONLINE_STATUS_LIST_POLL_INTERVAL_MS,
  useOnlineStatusPolling,
} from "../hooks/use-online-status-polling";
import { isVisibleMessageConversation } from "../message-unread";
import { getConversationDisplayTitle } from "../message-title";
import type { MessageListItemModel } from "../message.types";
import {
  isSelfConversationId,
  isSystemConversationId,
  normalizeSystemConversationId,
} from "../system-conversations";

const defaultConversationAvatar = require("../../../../assets/images/avatar_default.webp");
const systemNotificationAvatar = require("../../../../assets/svgs/message-system-notice.svg");
// 会话派生模型缓存（key = store 里的会话对象引用）
const itemModelCache = new WeakMap<MessageConversation, MessageListItemModel>();
// 设计稿 70-39249「消息页-无消息」：120×120 插画 + 8px 间距 + 12/18 #999 文案
const messagePromptIllustration = (
  <Image
    accessibilityIgnoresInvertColors
    contentFit="contain"
    source={require("../../../../assets/svgs/message-empty-prompt.svg")}
    style={{ width: 120, height: 120 }}
  />
);

export default function MessageScreen() {
  const insets = useSafeAreaInsets();
  const accessToken = useAuthStore((state) => state.accessToken);
  const userId = useAuthStore((state) => state.user?.id);
  const connectionState = useMessageStore((state) => state.connectionState);
  const conversationError = useMessageStore((state) => state.conversationError);
  const lastError = useMessageStore((state) => state.lastError);
  const conversations = useMessageStore((state) => state.conversations);
  const blacklistedUserIds = useMessageStore((state) => state.blacklistedUserIds);
  const initializeMessages = useMessageStore((state) => state.initialize);
  const refreshConversations = useMessageStore((state) => state.refreshConversations);
  const retryIfEmpty = useMessageStore((state) => state.retryIfEmpty);
  const refreshOnlineStatuses = useMessageStore((state) => state.refreshOnlineStatuses);

  const isFocused = useIsFocused();
  // 只有存在真实会话时才轮询；纯系统会话（通知/订单助手）没有在线状态
  const hasPeerConversations = useMemo(
    () => conversations.some((item) => !isSystemConversationId(item.id)),
    [conversations],
  );
  // 列表页轮询放宽到 15s：进页/App 回前台仍会立即查一次保时效，稳态少打接口
  useOnlineStatusPolling(
    isFocused && hasPeerConversations,
    accessToken,
    undefined,
    ONLINE_STATUS_LIST_POLL_INTERVAL_MS,
  );

  const handleRetry = async () => {
    if (!accessToken) return;
    // 连接异常先重连（initialize 内部完成会话同步）；仅列表类错误才刷新列表。
    // 非 ready 时 refreshConversations 会再触发一次 initialize，所以这里必须分支处理
    if (connectionState === "ready") {
      await refreshConversations(accessToken);
      return;
    }
    await initializeMessages(accessToken);
  };

  useFocusEffect(
    useCallback(() => {
      if (!accessToken) return;
      let cancelled = false;
      let retryTimer: ReturnType<typeof setTimeout> | undefined;
      // 兜底：补偿消息可能晚于首次快照落库——等刷新/初始化完成后再延迟重读一次
      // （store 内一次性闸门防循环；若在初始化完成前计时，非 ready 状态会让重试空跑）
      void refreshConversations(accessToken).finally(() => {
        if (cancelled) {
          return;
        }
        retryTimer = setTimeout(() => {
          void retryIfEmpty(accessToken);
        }, 1500);
      });
      return () => {
        cancelled = true;
        if (retryTimer) {
          clearTimeout(retryTimer);
        }
      };
    }, [accessToken, refreshConversations, retryIfEmpty]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active" && accessToken)
        void refreshOnlineStatuses(accessToken);
    });
    return () => subscription.remove();
  }, [accessToken, refreshOnlineStatuses]);

  // 列表项派生模型按会话对象引用缓存：store 更新（新消息/在线状态翻转）时未变化的
  // 会话保持原引用，派生 model 直接复用，列表项 memo 才能命中，避免整列重渲染；
  // model 内容只依赖会话对象本身（userId/黑名单只影响过滤），WeakMap 随 GC 回收
  const items = useMemo<MessageListItemModel[]>(() => {
    return conversations
      .filter((item) => isVisibleMessageConversation(item, userId, blacklistedUserIds))
      .map((item) => {
        const cached = itemModelCache.get(item);
        if (cached) return cached;
        const id = normalizeSystemConversationId(item.id);
        // 客服会话打标后标题只展示昵称；入口写入的【官方客服】前缀去掉避免重复
        const baseTitle = getConversationDisplayTitle(id, item.title, item.note);
        const title = item.isCustomerService
          ? stripCustomerServiceTitlePrefix(baseTitle)
          : baseTitle;
        const avatar = resolveConversationAvatar(
          item.avatar,
          isSystemConversationId(id)
            ? systemNotificationAvatar
            : defaultConversationAvatar,
          id,
        );
        const model: MessageListItemModel = {
          ...item,
          id,
          title,
          kind: "conversation",
          avatar: typeof avatar === "string" ? { uri: avatar } : avatar,
        };
        itemModelCache.set(item, model);
        return model;
      });
  }, [blacklistedUserIds, conversations, userId]);
  // 固定引用避免每次渲染生成新对象触发 FlatList 重渲染
  const listContentStyle = useMemo(
    () => ({ paddingBottom: 80 + insets.bottom }),
    [insets.bottom],
  );
  // useCallback 固定引用，配合 MessageListItem 的 memo，避免父组件重渲染击穿列表项
  const handleMessagePress = useCallback(
    (item: MessageListItemModel) => {
      if (item.kind !== "conversation" || isSelfConversationId(item.id, userId))
        return;
      const avatarUri = getConversationAvatarUri(item.avatar);
      router.push({
        pathname: "/chat/[id]",
        params: {
          id: normalizeSystemConversationId(item.id),
          title: item.title,
          clubId: item.clubId || "",
          ...(avatarUri ? { avatar: avatarUri } : {}),
        },
      });
    },
    [userId],
  );

  // renderItem 稳定引用：items 与 handleMessagePress 都是稳定引用时，列表项可完全命中 memo
  const renderMessageItem = useCallback(
    ({ item, index }: { item: MessageListItemModel; index: number }) => (
      <MessageListItem
        item={item}
        isLast={index === items.length - 1}
        onPress={handleMessagePress}
      />
    ),
    [items, handleMessagePress],
  );

  const stateMessage = !accessToken
    ? "登录后查看消息"
    : connectionState === "unavailable"
      ? "当前版本暂不支持即时消息"
      : connectionState === "idle" || connectionState === "connecting"
        ? "消息连接中..."
        : connectionState === "error"
          ? lastError || "消息连接失败"
          : items.length === 0 ? conversationError : null;
  // header 在布局内占位，tabbar 是悬浮层：状态区扣掉 tabbar 高度后，剩余区域才是视觉居中区
  const stateAreaStyle = useMemo(
    () => [styles.state, { paddingBottom: layout.tabBarHeight + insets.bottom }],
    [insets.bottom],
  );
  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <View style={[styles.navbar, { paddingTop: insets.top }]}>
        <MessageHeader
          onSearch={() =>
            router.push({ pathname: "/search", params: { type: "message" } })
          }
        />
      </View>
      {stateMessage ? (
        <View style={stateAreaStyle}>
          <EmptyState illustration={messagePromptIllustration} message={stateMessage} />
          {accessToken && (connectionState === "error" || conversationError) ? (
            <Pressable
              accessibilityRole="button"
              onPress={handleRetry}
              style={styles.retry}
            >
              <Text style={styles.retryText}>重试</Text>
            </Pressable>
          ) : null}
        </View>
      ) : items.length === 0 ? (
        <View style={stateAreaStyle}>
          <EmptyState illustration={messagePromptIllustration} message="暂无消息" />
        </View>
      ) : (
        <FlatList
          contentContainerStyle={listContentStyle}
          data={items}
          // 会话行轻量但数量可能上百：收窄挂载窗口，进入页面只渲染首屏，
          // 滚动时分批挂载，避免一次性铺设全部行
          initialNumToRender={12}
          keyExtractor={(item) => item.id}
          maxToRenderPerBatch={10}
          renderItem={renderMessageItem}
          showsVerticalScrollIndicator={false}
          windowSize={7}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F7F7" },
  navbar: { backgroundColor: "#FFFFFF" },
  state: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  retry: {
    marginTop: 2,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: "#FE1F4C",
  },
  retryText: { color: "#FFFFFF", fontSize: 13 },
});
