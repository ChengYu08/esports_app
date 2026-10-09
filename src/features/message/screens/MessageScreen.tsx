import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useEffect, useMemo } from "react";
import { router } from "expo-router";
import { useAuthStore } from "@esports/auth";
import { EmptyState } from "@/shared/ui/AsyncStates";

import { MessageHeader } from "../components/MessageHeader";
import { MessageListItem } from "../components/MessageListItem";
import { resolveConversationAvatar } from "../message-avatar";
import { useMessageStore } from "../message-store";
import type { MessageListItemModel } from "../message.types";

const defaultConversationAvatar = require("../../../../assets/coms/avatar_default_2.png");

export default function MessageScreen() {
  const insets = useSafeAreaInsets();
  const accessToken = useAuthStore((state) => state.accessToken);
  const initialize = useMessageStore((state) => state.initialize);
  const connectionState = useMessageStore((state) => state.connectionState);
  const lastError = useMessageStore((state) => state.lastError);
  const conversations = useMessageStore((state) => state.conversations);
  const clearAllUnread = useMessageStore((state) => state.clearAllUnread);

  useEffect(() => { if (accessToken) void initialize(accessToken); }, [accessToken, initialize]);

  const items = useMemo<MessageListItemModel[]>(() => conversations.map((item) => {
    const avatar = resolveConversationAvatar(item.title, item.avatar, defaultConversationAvatar);
    return { ...item, kind: "conversation", avatar: typeof avatar === "string" ? { uri: avatar } : avatar };
  }), [conversations]);
  const handleMessagePress = (item: MessageListItemModel) => {
    if (item.kind !== "conversation") return;
    router.push({ pathname: "/chat/[id]", params: { id: item.id, title: item.title } });
  };

  const stateMessage = !accessToken ? "登录后查看消息" : connectionState === "unavailable" ? "当前版本暂不支持即时消息" : connectionState === "connecting" ? "消息连接中..." : connectionState === "error" ? lastError || "消息连接失败" : null;
  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}> 
      <MessageHeader
        onClear={() => void clearAllUnread()}
        onSearch={() => router.push({ pathname: "/search", params: { type: "message" } })}
      />
      {stateMessage ? <View style={styles.state}><Text style={styles.stateText}>{stateMessage}</Text>{connectionState === "error" ? <Pressable accessibilityRole="button" onPress={() => accessToken && void initialize(accessToken)} style={styles.retry}><Text style={styles.retryText}>重试</Text></Pressable> : null}</View> : items.length === 0 ? <View style={styles.state}><EmptyState message="暂无消息" /></View> : <FlatList contentContainerStyle={{ paddingBottom: 80 + insets.bottom }} data={items} keyExtractor={(item) => item.id} renderItem={({ item, index }) => <MessageListItem item={item} isLast={index === items.length - 1} onPress={handleMessagePress} />} showsVerticalScrollIndicator={false} />}
    </View>
  );
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: "#F7F7F7" }, state: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }, stateText: { color: "#999999", fontSize: 14 }, retry: { marginTop: 12, paddingHorizontal: 18, paddingVertical: 8, borderRadius: 16, backgroundColor: "#FE1F4C" }, retryText: { color: "#FFFFFF", fontSize: 13 } });
