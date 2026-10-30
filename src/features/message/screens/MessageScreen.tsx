import { EmptyState } from "@/shared/ui/AsyncStates";
import { useAuthStore } from "@esports/auth";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo } from "react";
import { AppState, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { showToast } from "@/shared/ui/app-toast";
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

const defaultConversationAvatar = require("../../../../assets/coms/avatar_default.webp");
const systemNotificationAvatar = require("../../../../assets/message/message-system-notice.svg");

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
  const refreshOnlineStatuses = useMessageStore((state) => state.refreshOnlineStatuses);
  const clearAllUnread = useMessageStore((state) => state.clearAllUnread);

  const handleClear = async () => {
    await clearAllUnread();
    showToast("清理完成");
  };

  useFocusEffect(
    useCallback(() => {
      if (!accessToken) return;
      void refreshConversations(accessToken);
    }, [accessToken, refreshConversations]),
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
          const title = getConversationDisplayTitle(id, item.title, item.note);
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
  const handleMessagePress = (item: MessageListItemModel) => {
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
  };

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
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <MessageHeader
        onClear={() => void handleClear()}
        onSearch={() =>
          router.push({ pathname: "/search", params: { type: "message" } })
        }
      />
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
          renderItem={({ item, index }) => (
            <MessageListItem
              item={item}
              isLast={index === items.length - 1}
              onPress={handleMessagePress}
            />
          )}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F7F7" },
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
