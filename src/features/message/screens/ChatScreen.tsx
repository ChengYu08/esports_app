import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from "@esports/auth";

import { DOUYIN_SANS } from "@/shared/theme/typography";
import { MESSAGE_ITEMS } from "../message.data";
import {
  connectRongCloud,
  getRongMessages,
  sendRongText,
  subscribeRongConversationMessages,
  type RongTextMessage,
} from "../rongcloud-im";

const defaultAvatar = require("../../../../assets/message/avatar-wangzhe.svg");
const chatBack = require("../../../../assets/message/chat-back.svg");
const chatMore = require("../../../../assets/message/chat-more.svg");
const chatOnline = require("../../../../assets/message/chat-online.svg");
const chatOffline = require("../../../../assets/message/chat-offline.svg");
const chatEmoji = require("../../../../assets/message/chat-emoji.svg");
const chatPhoto = require("../../../../assets/message/chat-photo.svg");
const chatSend = require("../../../../assets/message/chat-send.svg");

const demoMessages: RongTextMessage[] = [
  { id: "demo-1", text: "搞不懂，太难了", time: "11:30", isMine: false },
  { id: "demo-2", text: "很简单", time: "11:30", isMine: true },
  { id: "demo-3", text: "我一会儿分享个链接给你，你看有空了直接进房就可以", time: "11:30", isMine: true },
  { id: "demo-4", text: "Okk", time: "11:30", isMine: false },
  { id: "demo-5", text: "你进来了吗", time: "11:30", isMine: true },
];

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const { id, title, avatar } = useLocalSearchParams<{ id?: string; title?: string; avatar?: string }>();
  const accessToken = useAuthStore((state) => state.accessToken);
  const [messages, setMessages] = useState<RongTextMessage[]>(demoMessages);
  const [draft, setDraft] = useState("");
  const [imReady, setImReady] = useState(false);
  const listRef = useRef<FlatList<RongTextMessage>>(null);
  const conversationId = String(id || "");
  const localConversation = useMemo(() => MESSAGE_ITEMS.find((item) => item.id === conversationId), [conversationId]);
  const conversationTitle = title || localConversation?.title || "用户聊天";
  const conversationAvatar = avatar || localConversation?.avatar || defaultAvatar;

  useEffect(() => {
    if (!conversationId) return;
    return subscribeRongConversationMessages(conversationId, (message) => {
      setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
    });
  }, [conversationId]);

  useEffect(() => {
    let active = true;
    if (!accessToken || !conversationId) return () => { active = false; };
    void connectRongCloud(accessToken).then(async (connected) => {
      if (!connected || !active) return;
      const history = await getRongMessages(conversationId);
      if (active) {
        setImReady(true);
        if (history.length > 0) setMessages(history);
      }
    });
    return () => { active = false; };
  }, [accessToken, conversationId]);

  const sendMessage = async () => {
    const text = draft.trim();
    if (!text) return;
    const optimistic: RongTextMessage = {
      id: `local-${Date.now()}`,
      text,
      time: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
      isMine: true,
    };
    setMessages((current) => [...current, optimistic]);
    setDraft("");
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    if (!imReady) return;
    try {
      await sendRongText(conversationId, text);
    } catch {
      // The optimistic message remains visible; the conversation list will reconcile on the next sync.
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
      style={styles.screen}
    >
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerRow}>
          <Pressable accessibilityLabel="返回" accessibilityRole="button" hitSlop={8} onPress={() => router.back()} style={styles.headerButton}>
            <Image source={chatBack} style={styles.headerIcon} />
          </Pressable>
          <View style={styles.identity}>
            <Image contentFit="cover" source={conversationAvatar} style={styles.headerAvatar} />
            <Text numberOfLines={1} style={styles.name}>{conversationTitle}</Text>
            <Image source={imReady ? chatOnline : chatOffline} style={styles.onlineIcon} />
            <Text style={[styles.onlineText, !imReady && styles.offlineText]}>{imReady ? "在线中" : "3天前在线"}</Text>
          </View>
          <Pressable accessibilityLabel="更多功能" accessibilityRole="button" hitSlop={8} onPress={() => undefined} style={styles.headerButton}>
            <Image source={chatMore} style={styles.headerIcon} />
          </Pressable>
        </View>
      </View>

      <FlatList
        ref={listRef}
        contentContainerStyle={styles.messageList}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ChatBubble item={item} avatar={conversationAvatar} />}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
      />

      <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TextInput
          accessibilityLabel="输入消息"
          multiline
          onChangeText={setDraft}
          placeholder="输入消息"
          placeholderTextColor="#CCCCCC"
          style={styles.input}
          value={draft}
        />
        <View style={styles.composerActions}>
          <View style={styles.toolButtons}>
            <Pressable accessibilityLabel="表情" accessibilityRole="button" hitSlop={8} onPress={() => setDraft((current) => `${current}😀`)} style={styles.toolButton}>
              <Image source={chatEmoji} style={styles.toolIcon} />
            </Pressable>
            <Pressable accessibilityLabel="图片" accessibilityRole="button" hitSlop={8} onPress={() => undefined} style={styles.toolButton}>
              <Image source={chatPhoto} style={styles.toolIcon} />
            </Pressable>
          </View>
          <Pressable accessibilityLabel="发送消息" accessibilityRole="button" disabled={!draft.trim()} onPress={() => void sendMessage()} style={[styles.sendButton, !draft.trim() && styles.sendButtonDisabled]}>
            <Text style={styles.sendText}>发送</Text>
            <Image source={chatSend} style={styles.sendIcon} />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function ChatBubble({ item, avatar }: { item: RongTextMessage; avatar: string | number }) {
  return (
    <View style={[styles.bubbleRow, item.isMine && styles.mineRow]}>
      {!item.isMine && <Image contentFit="cover" source={avatar} style={styles.messageAvatar} />}
      <View style={[styles.bubble, item.isMine ? styles.mineBubble : styles.theirBubble]}>
        <Text style={styles.bubbleText}>{item.text}</Text>
      </View>
      {item.isMine && <Image contentFit="cover" source={avatar} style={styles.messageAvatar} />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F7F7" },
  header: { backgroundColor: "#FFFFFF", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#EBEBEB" },
  headerRow: { height: 44, flexDirection: "row", alignItems: "center", paddingHorizontal: 8 },
  headerButton: { width: 40, height: 44, alignItems: "center", justifyContent: "center" },
  headerIcon: { width: 24, height: 24 },
  identity: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 8 },
  headerAvatar: { width: 32, height: 32, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: "#EBEBEB" },
  name: { flexShrink: 1, color: "#333333", fontFamily: DOUYIN_SANS, fontSize: 14, fontWeight: "600", lineHeight: 22 },
  onlineIcon: { width: 6, height: 6 },
  onlineText: { color: "#2FC273", fontFamily: DOUYIN_SANS, fontSize: 12 },
  offlineText: { color: "#999999" },
  messageList: { flexGrow: 1, paddingTop: 8, paddingBottom: 12 },
  bubbleRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingHorizontal: 16, paddingVertical: 8 },
  mineRow: { justifyContent: "flex-end", paddingLeft: 36, paddingRight: 16 },
  messageAvatar: { width: 36, height: 36, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: "#EBEBEB" },
  bubble: { maxWidth: "74%", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  theirBubble: { backgroundColor: "#FFFFFF" },
  mineBubble: { backgroundColor: "#FFF2F5" },
  bubbleText: { color: "#0A0A0A", fontFamily: DOUYIN_SANS, fontSize: 14, lineHeight: 22 },
  composer: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 12, borderTopRightRadius: 12, paddingHorizontal: 12, paddingTop: 12, gap: 8 },
  input: { minHeight: 60, maxHeight: 120, backgroundColor: "#F7F7F7", borderRadius: 8, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 12, color: "#0A0A0A", fontFamily: DOUYIN_SANS, fontSize: 14, lineHeight: 22, textAlignVertical: "top" },
  composerActions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  toolButtons: { flexDirection: "row", gap: 16 },
  toolButton: { width: 24, height: 24 },
  toolIcon: { width: 24, height: 24 },
  sendButton: { minWidth: 48, height: 24, borderRadius: 999, paddingHorizontal: 12, backgroundColor: "#FF708D", flexDirection: "row", gap: 4, alignItems: "center", justifyContent: "center" },
  sendButtonDisabled: { opacity: 0.55 },
  sendText: { color: "#FFFFFF", fontFamily: DOUYIN_SANS, fontSize: 12, lineHeight: 18 },
  sendIcon: { width: 14, height: 14 },
});
