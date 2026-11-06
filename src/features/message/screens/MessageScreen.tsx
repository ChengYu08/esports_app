import { EmptyState } from "@/shared/ui/AsyncStates";
import { useAuthStore } from "@esports/auth";
import { router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo } from "react";
import { AppState, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { showToast } from "@/shared/ui/app-toast";
import { stripCustomerServiceTitlePrefix } from "../customer-service.api";
import { MessageHeader } from "../components/MessageHeader";
import { MessageListItem } from "../components/MessageListItem";
import {
  getConversationAvatarUri,
  resolveConversationAvatar,
} from "../message-avatar";
import { useMessageStore } from "../message-store";
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

export default function MessageScreen() {
  const insets = useSafeAreaInsets();
  const accessToken = useAuthStore((state) => state.accessToken);
  const userId = useAuthStore((state) => state.user?.id);
  const connectionState = useMessageStore((state) => state.connectionState);
  const conversationError = useMessageStore((state) => state.conversationError);
  const lastError = useMessageStore((state) => state.lastError);
  const conversations = useMessageStore((state) => state.conversations);
  const blacklistedUserIds = useMessageStore((state) => state.blacklistedUserIds);
  const refreshConversations = useMessageStore((state) => state.refreshConversations);
  const retryIfEmpty = useMessageStore((state) => state.retryIfEmpty);
  const refreshOnlineStatuses = useMessageStore((state) => state.refreshOnlineStatuses);
  const clearAllUnread = useMessageStore((state) => state.clearAllUnread);

  const handleClear = async () => {
    await clearAllUnread();
    showToast("清理完成");
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

  const items = useMemo<MessageListItemModel[]>(
    () =>
      conversations
        .filter((item) => isVisibleMessageConversation(item, userId, blacklistedUserIds))
        .map((item) => {
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
          return {
            ...item,
            id,
            title,
            kind: "conversation",
            avatar: typeof avatar === "string" ? { uri: avatar } : avatar,
          };
        }),
    [blacklistedUserIds, conversations, userId],
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
  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <View style={[styles.navbar, { paddingTop: insets.top }]}>
        <MessageHeader
          onClear={() => void handleClear()}
          onSearch={() =>
            router.push({ pathname: "/search", params: { type: "message" } })
          }
        />
      </View>
      {stateMessage ? (
        <View style={styles.state}>
          <Text style={styles.stateText}>{stateMessage}</Text>
          {accessToken && (connectionState === "error" || conversationError) ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => accessToken && void refreshConversations(accessToken)}
              style={styles.retry}
            >
              <Text style={styles.retryText}>重试</Text>
            </Pressable>
          ) : null}
        </View>
      ) : items.length === 0 ? (
        <View style={styles.state}>
          <EmptyState message="暂无消息" />
        </View>
      ) : (
        <FlatList
          contentContainerStyle={{ paddingBottom: 80 + insets.bottom }}
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderMessageItem}
          showsVerticalScrollIndicator={false}
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
    padding: 24,
  },
  stateText: { color: "#999999", fontSize: 14 },
  retry: {
    marginTop: 12,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: "#FE1F4C",
  },
  retryText: { color: "#FFFFFF", fontSize: 13 },
});
