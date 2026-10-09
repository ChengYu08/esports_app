import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useEffect, useMemo } from "react";
import { router } from "expo-router";
import { useAuthStore } from "@esports/auth";

import { MessageHeader } from "../components/MessageHeader";
import { MessageListItem } from "../components/MessageListItem";
import { useMessageStore } from "../message-store";
import type { MessageListItemModel } from "../message.types";

const defaultConversationAvatar = require("../../../../assets/message/avatar-wangzhe.svg");

export default function MessageScreen() {
  const insets = useSafeAreaInsets();
  const accessToken = useAuthStore((state) => state.accessToken);
  const initialize = useMessageStore((state) => state.initialize);
  const connectionState = useMessageStore((state) => state.connectionState);
  const lastError = useMessageStore((state) => state.lastError);
  const conversations = useMessageStore((state) => state.conversations);

  useEffect(() => { if (accessToken) void initialize(accessToken); }, [accessToken, initialize]);

  const items = useMemo<MessageListItemModel[]>(() => conversations.map((item) => ({ ...item, kind: "conversation", avatar: item.avatar || defaultConversationAvatar })), [conversations]);
  const handleMessagePress = (item: MessageListItemModel) => {
    if (item.kind !== "conversation") return;
    router.push({ pathname: "/chat/[id]", params: { id: item.id, title: item.title, avatar: typeof item.avatar === "string" ? item.avatar : "" } });
  };

  const stateMessage = !accessToken ? "登录后查看消息" : connectionState === "unavailable" ? "当前版本暂不支持即时消息" : connectionState === "connecting" ? "消息连接中..." : connectionState === "error" ? lastError || "消息连接失败" : null;
  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}> 
      <MessageHeader onClear={() => undefined} onSearch={() => undefined} />
      {stateMessage ? <View style={styles.state}><Text style={styles.stateText}>{stateMessage}</Text>{connectionState === "error" ? <Pressable accessibilityRole="button" onPress={() => accessToken && void initialize(accessToken)} style={styles.retry}><Text style={styles.retryText}>重试</Text></Pressable> : null}</View> : items.length === 0 ? <View style={styles.state}><Text style={styles.stateText}>暂无消息</Text></View> : <FlatList contentContainerStyle={{ paddingBottom: 80 + insets.bottom }} data={items} keyExtractor={(item) => item.id} renderItem={({ item, index }) => <MessageListItem item={item} isLast={index === items.length - 1} onPress={handleMessagePress} />} showsVerticalScrollIndicator={false} />}
    </View>
  );
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: "#F7F7F7" }, state: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }, stateText: { color: "#999999", fontSize: 14 }, retry: { marginTop: 12, paddingHorizontal: 18, paddingVertical: 8, borderRadius: 16, backgroundColor: "#FE1F4C" }, retryText: { color: "#FFFFFF", fontSize: 13 } });
