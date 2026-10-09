import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  NativeSyntheticEvent,
  NativeScrollEvent,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from "@esports/auth";
import EmojiPicker, { type EmojiType } from "rn-emoji-keyboard";

import { createImagePreviewParams } from "@/features/mine/image-preview.params";
import { DOUYIN_SANS } from "@/shared/theme/typography";
import { useMessageStore } from "../message-store";
import type { ManagedMessage } from "../message-state";
import type { AfterSaleCardPayload } from "@/features/order/after-sale-card";

const defaultAvatar = require("../../../../assets/coms/avatar_default_2.png");
const defaultMyAvatar = require("../../../../assets/mine/figma/mine-avatar.png");
const chatBack = require("../../../../assets/message/chat-back.svg");
const chatMore = require("../../../../assets/message/chat-more.svg");
const chatOnline = require("../../../../assets/message/chat-online.svg");
const chatOffline = require("../../../../assets/message/chat-offline.svg");
const chatEmoji = require("../../../../assets/message/chat-emoji.svg");
const chatPhoto = require("../../../../assets/message/chat-photo.svg");
const chatSend = require("../../../../assets/message/chat-send.svg");
const EMPTY_MESSAGES: ManagedMessage[] = [];

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const { id, title, avatar, afterSale } = useLocalSearchParams<{ id?: string; title?: string; avatar?: string; afterSale?: string }>();
  const accessToken = useAuthStore((state) => state.accessToken);
  const myAvatarUrl = useAuthStore((state) => state.user?.headImage);
  const [draft, setDraft] = useState("");
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [imageSending, setImageSending] = useState(false);
  const listRef = useRef<FlatList<ManagedMessage>>(null);
  const initialHistoryLoaded = useRef(false);
  const shouldScrollToEnd = useRef(false);
  const isNearBottom = useRef(true);
  const previousMessageCount = useRef(0);
  const conversationId = String(id || "");
  const conversation = useMessageStore((state) => state.conversations.find((item) => item.id === conversationId));
  const messages = useMessageStore((state) => state.messagesByPeerId[conversationId] || EMPTY_MESSAGES);
  const connectionState = useMessageStore((state) => state.connectionState);
  const lastError = useMessageStore((state) => state.lastError);
  const openConversation = useMessageStore((state) => state.openConversation);
  const closeConversation = useMessageStore((state) => state.closeConversation);
  const sendText = useMessageStore((state) => state.sendText);
  const sendImage = useMessageStore((state) => state.sendImage);
  const sendAfterSaleCard = useMessageStore((state) => state.sendAfterSaleCard);
  const [afterSalePayload, setAfterSalePayload] = useState<AfterSaleCardPayload | null>(() => {
    if (!afterSale || typeof afterSale !== "string") return null;
    try { return JSON.parse(afterSale) as AfterSaleCardPayload; } catch { return null; }
  });
  const retryMessage = useMessageStore((state) => state.retryMessage);
  const loadOlder = useMessageStore((state) => state.loadOlder);
  const historyState = useMessageStore((state) => state.historyByPeerId[conversationId]);
  const historyLoading = historyState?.loading || false;
  const conversationTitle = title || conversation?.title || "用户聊天";
  const conversationAvatar = avatar || conversation?.avatar || defaultAvatar;
  const myAvatar = myAvatarUrl ? { uri: myAvatarUrl } : defaultMyAvatar;
  const imReady = connectionState === "ready";
  const scrollToLatest = () => requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: false }));

  useEffect(() => {
    initialHistoryLoaded.current = false;
    shouldScrollToEnd.current = false;
    isNearBottom.current = true;
    previousMessageCount.current = 0;
    if (accessToken && conversationId) void openConversation({ id: conversationId, title: conversationTitle, avatar: typeof conversationAvatar === "string" ? conversationAvatar : undefined });
    return () => closeConversation();
  }, [accessToken, closeConversation, connectionState, conversationAvatar, conversationId, conversationTitle, openConversation]);

  useEffect(() => {
    if (!historyState || historyState.loading) return;

    if (!initialHistoryLoaded.current) {
      initialHistoryLoaded.current = true;
      previousMessageCount.current = messages.length;
      shouldScrollToEnd.current = true;
      scrollToLatest();
      return;
    }

    if (messages.length > previousMessageCount.current && isNearBottom.current) {
      shouldScrollToEnd.current = true;
      scrollToLatest();
    }
    previousMessageCount.current = messages.length;
  }, [historyState, messages.length]);

  const sendMessage = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    await sendText(conversationId, text);
  };

  const selectEmoji = (emoji: EmojiType) => {
    setDraft((current) => `${current}${emoji.emoji}`);
  };

  const pickImage = async () => {
    if (imageSending) return;
    setEmojiPickerOpen(false);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("需要访问相册", "请在系统设置中允许访问照片，用于发送聊天图片。");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;

    const image = result.assets[0];
    setImageSending(true);
    await sendImage(conversationId, image.uri);
    setImageSending(false);
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
    isNearBottom.current = distanceFromBottom <= 48;
    if (contentOffset.y < 24 && !historyLoading) void loadOlder(conversationId);
  };

  const handleContentSizeChange = () => {
    if (!shouldScrollToEnd.current) return;
    shouldScrollToEnd.current = false;
    scrollToLatest();
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
        renderItem={({ item }) => <ChatBubble item={item} peerAvatar={conversationAvatar} myAvatar={myAvatar} onRetry={() => void retryMessage(conversationId, item.clientId || "")} />}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={handleContentSizeChange}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        onScroll={handleScroll}
        scrollEventThrottle={150}
      />
      {afterSalePayload ? <Pressable style={styles.afterSaleGuide} onPress={() => { void sendAfterSaleCard(conversationId, afterSalePayload).then(() => setAfterSalePayload(null)); }}><View style={styles.afterSaleGuideCopy}><Text style={styles.afterSaleGuideTitle}>发送订单信息给售后客服</Text><Text style={styles.afterSaleGuideSub}>订单服务不满意，申请售后～ · 订单 {afterSalePayload.orderNo || afterSalePayload.orderId}</Text></View><Text style={styles.afterSaleGuideButton}>点击发送</Text></Pressable> : null}
      {lastError && connectionState !== "ready" ? <Text style={styles.errorBanner}>{lastError}</Text> : null}

      <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TextInput
          accessibilityLabel="输入消息"
          multiline
          onChangeText={setDraft}
          onFocus={() => setEmojiPickerOpen(false)}
          placeholder="输入消息"
          placeholderTextColor="#CCCCCC"
          style={styles.input}
          value={draft}
        />
        <View style={styles.composerActions}>
          <View style={styles.toolButtons}>
            <Pressable accessibilityLabel="表情" accessibilityRole="button" hitSlop={8} onPress={() => { Keyboard.dismiss(); setEmojiPickerOpen(true); }} style={styles.toolButton}>
              <Image source={chatEmoji} style={styles.toolIcon} />
            </Pressable>
            <Pressable accessibilityLabel="图片" accessibilityRole="button" disabled={imageSending} hitSlop={8} onPress={() => void pickImage()} style={[styles.toolButton, imageSending && styles.toolButtonDisabled]}>
              <Image source={chatPhoto} style={styles.toolIcon} />
            </Pressable>
          </View>
          <Pressable accessibilityLabel="发送消息" accessibilityRole="button" disabled={!draft.trim()} onPress={() => void sendMessage()} style={[styles.sendButton, !draft.trim() && styles.sendButtonDisabled]}>
            <Text style={styles.sendText}>发送</Text>
            <Image source={chatSend} style={styles.sendIcon} />
          </Pressable>
        </View>
      </View>
      <EmojiPicker
        defaultHeight={340}
        enableRecentlyUsed
        onClose={() => setEmojiPickerOpen(false)}
        onEmojiSelected={selectEmoji}
        open={emojiPickerOpen}
        theme={{
          backdrop: "rgba(0, 0, 0, 0.18)",
          knob: "#CCCCCC",
          container: "#FFFFFF",
          header: "#333333",
          category: { icon: "#999999", iconActive: "#FE1F4C" },
        }}
      />
    </KeyboardAvoidingView>
  );
}

function ChatBubble({ item, peerAvatar, myAvatar, onRetry }: { item: ManagedMessage; peerAvatar: string | number; myAvatar: { uri: string } | number; onRetry: () => void }) {
  return (
    <View style={[styles.bubbleRow, item.isMine && styles.mineRow]}>
      {!item.isMine && <Image contentFit="cover" source={peerAvatar} style={styles.messageAvatar} />}
      <View style={[styles.bubble, item.isMine ? styles.mineBubble : styles.theirBubble, item.kind === "image" && styles.imageBubble]}>
        {item.kind === "image" ? (
          <Pressable
            accessibilityLabel="预览聊天图片"
            onPress={() => router.push({ pathname: "/image-preview", params: createImagePreviewParams([item.imageUrl], 0) })}
          >
            <Image contentFit="cover" source={{ uri: item.imageUrl }} style={styles.messageImage} />
          </Pressable>
        ) : item.kind === "afterSale" ? <View style={styles.afterSaleCard}><Text style={styles.afterSaleCardTitle}>{item.title}</Text><Text style={styles.afterSaleCardSub}>订单 {item.orderNo || "-"}</Text></View> : <Text style={styles.bubbleText}>{item.text}</Text>}
      </View>
      {item.isMine && <Image contentFit="cover" source={myAvatar} style={styles.messageAvatar} />}
      {item.status === "failed" ? <Pressable accessibilityRole="button" onPress={onRetry}><Text style={styles.retryLabel}>重试</Text></Pressable> : null}
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
  retryLabel: { color: "#FE1F4C", fontFamily: DOUYIN_SANS, fontSize: 12, marginLeft: 4, marginTop: 8 },
  errorBanner: { color: "#FE1F4C", backgroundColor: "#FFF1F3", fontFamily: DOUYIN_SANS, fontSize: 12, lineHeight: 18, paddingHorizontal: 16, paddingVertical: 8, textAlign: "center" },
  bubbleText: { color: "#0A0A0A", fontFamily: DOUYIN_SANS, fontSize: 14, lineHeight: 22 },
  imageBubble: { padding: 0, overflow: "hidden" },
  messageImage: { width: 168, height: 168 },
  composer: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 12, borderTopRightRadius: 12, paddingHorizontal: 12, paddingTop: 12, gap: 8 },
  input: { minHeight: 60, maxHeight: 120, backgroundColor: "#F7F7F7", borderRadius: 8, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 12, color: "#0A0A0A", fontFamily: DOUYIN_SANS, fontSize: 14, lineHeight: 22, textAlignVertical: "top" },
  composerActions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  toolButtons: { flexDirection: "row", gap: 16 },
  toolButton: { width: 24, height: 24 },
  toolButtonDisabled: { opacity: 0.45 },
  toolIcon: { width: 24, height: 24 },
  sendButton: { minWidth: 48, height: 24, borderRadius: 999, paddingHorizontal: 12, backgroundColor: "#FE1F4C", flexDirection: "row", gap: 4, alignItems: "center", justifyContent: "center" },
  sendButtonDisabled: { opacity: 0.55 },
  sendText: { color: "#FFFFFF", fontFamily: DOUYIN_SANS, fontSize: 12, lineHeight: 18 },
  sendIcon: { width: 14, height: 14 },
  afterSaleGuide: { marginHorizontal: 12, marginBottom: 8, padding: 12, backgroundColor: "#FFF2F5", borderRadius: 10, flexDirection: "row", alignItems: "center" },
  afterSaleGuideCopy: { flex: 1 }, afterSaleGuideTitle: { color: "#111", fontSize: 14, fontWeight: "600" }, afterSaleGuideSub: { color: "#888", fontSize: 11, marginTop: 4 }, afterSaleGuideButton: { color: "#FE1F4C", fontSize: 13, fontWeight: "600" },
  afterSaleCard: { minWidth: 190, padding: 4 }, afterSaleCardTitle: { color: "#111", fontSize: 14, fontWeight: "600" }, afterSaleCardSub: { color: "#777", fontSize: 12, marginTop: 8 },
});
