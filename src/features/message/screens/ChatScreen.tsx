import { useAuthStore } from "@esports/auth";
import { HeadphonesRegular } from "@fluentui/react-native-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import EmojiPicker, { type EmojiType } from "rn-emoji-keyboard";

import { createImagePreviewParams } from "@/features/mine/image-preview.params";
import type { AfterSaleCardPayload } from "@/features/order/after-sale-card";
import { afterSaleCardRows } from "@/features/order/after-sale-card";
import { DOUYIN_SANS } from "@/shared/theme/typography";
import { EmptyState } from "@/shared/ui/AsyncStates";
import { BottomSheet } from "@/shared/ui/BottomSheet";
import { CachedImage } from "@/shared/ui/CachedImage";
import { CsInviteCard } from "../components/CsInviteCard";
import { OrderNotifyCard } from "../components/OrderNotifyCard";
import { resolveConversationAvatar } from "../message-avatar";
import type { ManagedMessage } from "../message-state";
import { useMessageStore } from "../message-store";
import { getConversationDisplayTitle } from "../message-title";
import {
  getSystemConversationTitle,
  isDispatchAssistantConversationId,
  isOrderAssistantConversationId,
  isSystemConversationId,
  isSelfConversationId,
  normalizeSystemConversationId,
} from "../system-conversations";

const defaultAvatar = require("../../../../assets/coms/avatar_default.webp");
const defaultMyAvatar = require("../../../../assets/mine/figma/mine-avatar.png");
const chatBack = require("../../../../assets/message/chat-back.svg");
const chatMore = require("../../../../assets/message/chat-more.svg");
const chatOnline = require("../../../../assets/message/chat-online.svg");
const chatOffline = require("../../../../assets/message/chat-offline.svg");
const chatEmoji = require("../../../../assets/message/chat-emoji.svg");
const chatPhoto = require("../../../../assets/message/chat-photo.svg");
const chatSend = require("../../../../assets/message/chat-send.svg");
const chatArrowRight = require("../../../../assets/mine/figma/mine-arrow-right.svg");
const systemNotificationAvatar = require("../../../../assets/message/message-system-notice.svg");
const EMPTY_MESSAGES: ManagedMessage[] = [];

type ChatListRow =
  | { key: string; kind: "time"; label: string }
  | { key: string; kind: "message"; message: ManagedMessage };

function formatMessageTimeSeparator(timestamp: number) {
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${month}-${day} ${hours}:${minutes}`;
}

function buildChatListRows(messages: ManagedMessage[]): ChatListRow[] {
  return messages.flatMap((message, index) => {
    const previousMessage = messages[index - 1];
    const showTime =
      !previousMessage || message.sentAt - previousMessage.sentAt > 5 * 60 * 1000;
    return [
      ...(showTime
        ? [{
            key: `time-${message.id}`,
            kind: "time" as const,
            label: formatMessageTimeSeparator(message.sentAt),
          }]
        : []),
      { key: message.id, kind: "message" as const, message },
    ];
  });
}

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const { id, title, avatar, clubId, afterSale } = useLocalSearchParams<{
    id?: string;
    title?: string;
    avatar?: string;
    clubId?: string;
    afterSale?: string;
  }>();
  const accessToken = useAuthStore((state) => state.accessToken);
  const userId = useAuthStore((state) => state.user?.id);
  const myAvatarUrl = useAuthStore((state) => state.user?.headImage);
  const myNickname = useAuthStore((state) => state.user?.nickname);
  const [afterSaleSending, setAfterSaleSending] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [noteVisible, setNoteVisible] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const listRef = useRef<FlatList<ChatListRow>>(null);
  const isNearBottom = useRef(true);
  const scrollFrame = useRef<number | null>(null);
  const conversationId = normalizeSystemConversationId(String(id || ""));
  const isSelfConversation = isSelfConversationId(conversationId, userId);
  const canViewProfile = !isSystemConversationId(conversationId);
  const conversation = useMessageStore((state) =>
    state.conversations.find((item) => item.id === conversationId),
  );
  const messages = useMessageStore(
    (state) => state.messagesByPeerId[conversationId] || EMPTY_MESSAGES,
  );
  const isPeerBlacklisted = useMessageStore((state) =>
    state.blacklistedUserIds.includes(conversationId),
  );
  const visibleMessages = useMemo(
    () => isPeerBlacklisted ? messages.filter((message) => message.isMine) : messages,
    [isPeerBlacklisted, messages],
  );
  const chatRows = useMemo(
    () => buildChatListRows(visibleMessages).slice().reverse(),
    [visibleMessages],
  );
  const connectionState = useMessageStore((state) => state.connectionState);
  const lastError = useMessageStore((state) => state.lastError);
  const refreshOnlineStatuses = useMessageStore((state) => state.refreshOnlineStatuses);
  const openConversation = useMessageStore((state) => state.openConversation);
  const closeConversation = useMessageStore((state) => state.closeConversation);
  const sendText = useMessageStore((state) => state.sendText);
  const sendImage = useMessageStore((state) => state.sendImage);
  const resolveImagePreview = useMessageStore((state) => state.resolveImagePreview);
  const sendAfterSaleCard = useMessageStore((state) => state.sendAfterSaleCard);
  const setConversationNote = useMessageStore(
    (state) => state.setConversationNote,
  );
  const setConversationPinned = useMessageStore(
    (state) => state.setConversationPinned,
  );
  const [afterSalePayload, setAfterSalePayload] =
    useState<AfterSaleCardPayload | null>(() => {
      if (!afterSale || typeof afterSale !== "string") return null;
      try {
        return JSON.parse(afterSale) as AfterSaleCardPayload;
      } catch {
        return null;
      }
    });
  const retryMessage = useMessageStore((state) => state.retryMessage);
  const loadOlder = useMessageStore((state) => state.loadOlder);
  const historyState = useMessageStore(
    (state) => state.historyByPeerId[conversationId],
  );
  const historyLoading = historyState?.loading || false;
  const conversationBaseTitle = getSystemConversationTitle(
    conversationId,
    conversation?.title || title || "用户聊天",
  );
  const conversationTitle = getConversationDisplayTitle(
    conversationId,
    conversationBaseTitle,
    conversation?.note,
  );
  const conversationAvatar = resolveConversationAvatar(
    avatar || conversation?.avatar,
    isSystemConversationId(conversationId) ? systemNotificationAvatar : defaultAvatar,
    conversationId,
  );
  const myAvatar = useMemo(
    () => myAvatarUrl ? { uri: myAvatarUrl } : defaultMyAvatar,
    [myAvatarUrl],
  );
  const peerOnline = conversation?.isOnline;
  useFocusEffect(
    useCallback(() => {
      if (accessToken) void refreshOnlineStatuses(accessToken);
    }, [accessToken, refreshOnlineStatuses]),
  );
  const isOrderAssistant = isOrderAssistantConversationId(conversationId);
  const isDispatchAssistant = isDispatchAssistantConversationId(conversationId);
  const isPinned = Boolean(conversation?.isPinned);
  const scrollToLatest = useCallback(() => {
    isNearBottom.current = true;
    if (scrollFrame.current !== null) cancelAnimationFrame(scrollFrame.current);
    // In an inverted list, the newest message is at offset zero.
    // Wait for the pending message and composer layout to be committed.
    scrollFrame.current = requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
      scrollFrame.current = null;
    });
  }, []);
  const handleSendText = useCallback(async (text: string) => {
    if (isSelfConversation) return;
    scrollToLatest();
    await sendText(conversationId, text);
  }, [conversationId, isSelfConversation, scrollToLatest, sendText]);
  const handleSendImage = useCallback(
    (imageUri: string) => {
      scrollToLatest();
      return sendImage(conversationId, imageUri);
    },
    [conversationId, scrollToLatest, sendImage],
  );
  const handleRetryMessage = useCallback(
    (clientId: string) => {
      scrollToLatest();
      void retryMessage(conversationId, clientId);
    },
    [conversationId, retryMessage, scrollToLatest],
  );
  const openOrderDetail = useCallback((orderId: string) => {
    router.push({ pathname: "/order/[id]", params: { id: orderId } });
  }, []);
  const openImagePreview = useCallback(async (message: ManagedMessage) => {
    try {
      const uri = await resolveImagePreview(conversationId, message);
      router.push({ pathname: "/image-preview", params: createImagePreviewParams([uri], 0) });
    } catch (error) {
      Alert.alert(
        "图片预览失败",
        error instanceof Error ? error.message : "融云图片下载失败",
      );
    }
  }, [conversationId, resolveImagePreview]);
  const openProfile = useCallback(() => {
    setSettingsVisible(false);
    if (!/^\d+$/.test(conversationId)) {
      Alert.alert(
        "暂无法查看主页",
        "当前会话缺少主页信息，请从用户主页重新发起聊天。",
      );
      return;
    }
    const targetClubId =
      clubId ||
      conversation?.clubId ||
      (afterSalePayload?.clubId ? String(afterSalePayload.clubId) : undefined);
    router.push({
      pathname: "/profile",
      params: {
        ...(targetClubId ? { clubId: String(targetClubId) } : {}),
        userId: conversationId,
      },
    });
  }, [
    afterSalePayload,
    clubId,
    conversation?.clubId,
    conversationId,
  ]);
  const renderChatRow = useCallback(
    ({ item }: { item: ChatListRow }) => item.kind === "time" ? (
      <View style={styles.timeSeparator}>
        <Text style={styles.timeSeparatorText}>{item.label}</Text>
      </View>
    ) : (
      <ChatBubble
        item={item.message}
        peerAvatar={conversationAvatar}
        myAvatar={myAvatar}
        peerName={conversation?.title || title || "用户"}
        myName={myNickname || "我"}
        onEnterRoomInvite={(roomId, roomVersion) => router.push({
          pathname: "/voice-room/[id]",
          params: { id: roomId, v: roomVersion },
        })}
        onRetry={handleRetryMessage}
        onOpenProfile={canViewProfile ? openProfile : undefined}
        onOpenOrder={isOrderAssistant ? openOrderDetail : undefined}
        onPreviewImage={openImagePreview}
      />
    ),
    [canViewProfile, conversation?.title, conversationAvatar, handleRetryMessage, isOrderAssistant, myAvatar, myNickname, openImagePreview, openOrderDetail, openProfile, title],
  );

  useEffect(() => {
    isNearBottom.current = true;
    return () => {
      if (scrollFrame.current !== null) cancelAnimationFrame(scrollFrame.current);
      scrollFrame.current = null;
    };
  }, [conversationId]);

  useEffect(() => {
    if (isSelfConversation) {
      router.back();
      return () => closeConversation(conversationId);
    }
    if (accessToken && conversationId)
      void openConversation({
        id: conversationId,
        title: conversationBaseTitle,
        avatar:
          typeof conversationAvatar === "string"
            ? conversationAvatar
            : undefined,
        clubId: clubId || conversation?.clubId,
      });
    return () => closeConversation(conversationId);
  }, [
    accessToken,
    closeConversation,
    clubId,
    connectionState,
    conversation?.clubId,
    conversationAvatar,
    conversationBaseTitle,
    conversationId,
    isSelfConversation,
    openConversation,
  ]);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    // Native content anchoring can emit a scroll before our requested scroll runs.
    if (scrollFrame.current !== null) return;
    isNearBottom.current = event.nativeEvent.contentOffset.y <= 48;
  }, []);

  const handleLoadOlder = useCallback(() => {
    if (!historyLoading) void loadOlder(conversationId);
  }, [conversationId, historyLoading, loadOlder]);

  const handleScrollBeginDrag = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (scrollFrame.current !== null) cancelAnimationFrame(scrollFrame.current);
    scrollFrame.current = null;
    isNearBottom.current = event.nativeEvent.contentOffset.y <= 48;
  }, []);

  const keepLatestVisible = useCallback(() => {
    if (isNearBottom.current) scrollToLatest();
  }, [scrollToLatest]);

  const openNoteEditor = () => {
    setNoteDraft(conversation?.note || "");
    setSettingsVisible(false);
    setNoteVisible(true);
  };

  const saveNote = () => {
    setConversationNote(conversationId, noteDraft.trim());
    setNoteVisible(false);
  };

  if (isSelfConversation) return null;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
      style={styles.screen}
    >
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerRow}>
          <Pressable
            accessibilityLabel="返回"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => router.back()}
            style={styles.headerButton}
          >
            <Image source={chatBack} style={styles.headerIcon} />
          </Pressable>
          <View style={styles.identity}>
            <Pressable
              accessibilityLabel="查看用户主页"
              accessibilityRole="button"
              disabled={!canViewProfile}
              hitSlop={8}
              onPress={openProfile}
            >
              <CachedImage
                contentFit="cover"
                source={conversationAvatar}
                style={styles.headerAvatar}
              />
            </Pressable>
            <Text numberOfLines={1} style={styles.name}>
              {conversationTitle}
            </Text>
            {!isSystemConversationId(conversationId) && typeof peerOnline === "boolean" ? (
              <>
                <Image
                  source={peerOnline ? chatOnline : chatOffline}
                  style={styles.onlineIcon}
                />
                <Text
                  style={[styles.onlineText, !peerOnline && styles.offlineText]}
                >
                  {peerOnline ? "在线中" : "离线"}
                </Text>
              </>
            ) : null}
          </View>
          <Pressable
            accessibilityLabel="更多功能"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => setSettingsVisible(true)}
            style={styles.headerButton}
          >
            <Image source={chatMore} style={styles.headerIcon} />
          </Pressable>
        </View>
      </View>

      <FlatList
        key={conversationId}
        ref={listRef}
        inverted
        contentContainerStyle={styles.messageList}
        data={chatRows}
        keyExtractor={(item) => item.key}
        ListEmptyComponent={isOrderAssistant ? (
          <EmptyState message="暂无订单消息" style={styles.orderAssistantEmpty} />
        ) : null}
        renderItem={renderChatRow}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={keepLatestVisible}
        onLayout={keepLatestVisible}
        maintainVisibleContentPosition={{ minIndexForVisible: 0, autoscrollToTopThreshold: 48 }}
        onEndReached={handleLoadOlder}
        onEndReachedThreshold={0.2}
        onScroll={handleScroll}
        onScrollBeginDrag={handleScrollBeginDrag}
        scrollEventThrottle={16}
      />
      {afterSalePayload ? (
        <View style={styles.afterSaleGuide}>
          <View style={styles.afterSaleGuideCopy}>
            <Text style={styles.afterSaleGuideTitle}>
              发送订单信息给售后客服
            </Text>
            <Text
              numberOfLines={1}
              style={styles.afterSaleGuideSub}
            >{`订单服务不满意，申请售后～ · 订单 ${afterSalePayload.orderNo || afterSalePayload.orderId}`}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={afterSaleSending}
            onPress={async () => {
              setAfterSaleSending(true);
              const sent = await sendAfterSaleCard(
                conversationId,
                afterSalePayload,
              );
              setAfterSaleSending(false);
              if (sent) {
                scrollToLatest();
                setAfterSalePayload(null);
              }
            }}
          >
            <Text
              style={[
                styles.afterSaleGuideButton,
                afterSaleSending && styles.afterSaleGuideButtonDisabled,
              ]}
            >
              {afterSaleSending ? "发送中..." : "点击发送"}
            </Text>
          </Pressable>
          <Pressable
            accessibilityLabel="关闭售后引导"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => setAfterSalePayload(null)}
            style={styles.afterSaleGuideClose}
          >
            <Text style={styles.afterSaleGuideCloseText}>×</Text>
          </Pressable>
        </View>
      ) : null}
      {lastError && connectionState !== "ready" ? (
        <Text style={styles.errorBanner}>{lastError}</Text>
      ) : null}

      {!isOrderAssistant && !isDispatchAssistant ? (
        <ChatComposer
          bottomInset={insets.bottom}
          onSendText={handleSendText}
          onSendImage={handleSendImage}
        />
      ) : null}
      <BottomSheet
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        scrollable
        contentStyle={[
          styles.settingsSheet,
          { paddingBottom: Math.max(insets.bottom, 20) },
        ]}
      >
        <View onStartShouldSetResponder={() => true}>
          <View style={styles.sheetTitleRow}>
            <Text style={styles.sheetTitle}>消息设置</Text>
            <Pressable
              accessibilityLabel="关闭消息设置"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => setSettingsVisible(false)}
              style={styles.sheetClose}
            >
              <Text style={styles.sheetCloseText}>×</Text>
            </Pressable>
          </View>
          <View style={styles.sheetOptions}>
            <View style={styles.sheetOption}>
              <Text style={styles.sheetOptionText}>置顶对话</Text>
              <Pressable
                accessibilityLabel="置顶对话"
                accessibilityRole="switch"
                accessibilityState={{ checked: isPinned }}
                onPress={() => setConversationPinned(conversationId, !isPinned)}
                style={[styles.switch, isPinned && styles.switchActive]}
              >
                <View
                  style={[
                    styles.switchKnob,
                    isPinned && styles.switchKnobActive,
                  ]}
                />
              </Pressable>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={openNoteEditor}
              style={styles.sheetOption}
            >
              <Text style={styles.sheetOptionText}>备注</Text>
              <View style={styles.sheetOptionRight}>
                {conversation?.note ? (
                  <Text numberOfLines={1} style={styles.sheetNote}>
                    {conversation.note}
                  </Text>
                ) : null}
                <Image source={chatArrowRight} style={styles.sheetArrow} />
              </View>
            </Pressable>
            {canViewProfile ? (
              <Pressable
                accessibilityRole="button"
                onPress={openProfile}
                style={styles.sheetOption}
              >
                <Text style={styles.sheetOptionText}>查看个人主页</Text>
                <Image source={chatArrowRight} style={styles.sheetArrow} />
              </Pressable>
            ) : null}
          </View>
        </View>
      </BottomSheet>
      <Modal
        animationType="fade"
        transparent
        visible={noteVisible}
        onRequestClose={() => setNoteVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalKeyboard}
        >
          <Pressable
            style={[
              styles.noteBackdrop,
              { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
            ]}
            onPress={() => setNoteVisible(false)}
          >
            <View
              onStartShouldSetResponder={() => true}
              style={styles.noteDialog}
            >
              <Text style={styles.noteTitle}>备注</Text>
              <TextInput
                autoFocus
                maxLength={30}
                onChangeText={setNoteDraft}
                placeholder="请输入备注"
                placeholderTextColor="#CCCCCC"
                style={styles.noteInput}
                value={noteDraft}
              />
              <View style={styles.noteActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setNoteVisible(false)}
                  style={styles.noteCancel}
                >
                  <Text style={styles.noteCancelText}>取消</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={saveNote}
                  style={styles.noteConfirm}
                >
                  <Text style={styles.noteConfirmText}>保存</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const ChatComposer = memo(function ChatComposer({
  bottomInset,
  onSendText,
  onSendImage,
}: {
  bottomInset: number;
  onSendText: (text: string) => Promise<void>;
  onSendImage: (imageUri: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [imageSending, setImageSending] = useState(false);

  const selectEmoji = useCallback((emoji: EmojiType) => {
    setDraft((current) => `${current}${emoji.emoji}`);
  }, []);

  const sendMessage = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    await onSendText(text);
  };

  const pickImage = async () => {
    if (imageSending) return;
    setEmojiPickerOpen(false);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "需要访问相册",
        "请在系统设置中允许访问照片，用于发送聊天图片。",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;

    setImageSending(true);
    try {
      await onSendImage(result.assets[0].uri);
    } finally {
      setImageSending(false);
    }
  };

  return (
    <>
      <View
        style={[
          styles.composer,
          { paddingBottom: Math.max(bottomInset, 16) },
        ]}
      >
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
            <Pressable
              accessibilityLabel="表情"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => {
                Keyboard.dismiss();
                setEmojiPickerOpen(true);
              }}
              style={styles.toolButton}
            >
              <Image source={chatEmoji} style={styles.toolIcon} />
            </Pressable>
            <Pressable
              accessibilityLabel="图片"
              accessibilityRole="button"
              disabled={imageSending}
              hitSlop={8}
              onPress={() => void pickImage()}
              style={[
                styles.toolButton,
                imageSending && styles.toolButtonDisabled,
              ]}
            >
              <Image source={chatPhoto} style={styles.toolIcon} />
            </Pressable>
          </View>
          <Pressable
            accessibilityLabel="发送消息"
            accessibilityRole="button"
            disabled={!draft.trim()}
            onPress={() => void sendMessage()}
            style={[
              styles.sendButton,
              !draft.trim() && styles.sendButtonDisabled,
            ]}
          >
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
    </>
  );
});

const ChatBubble = memo(function ChatBubble({
  item,
  peerAvatar,
  myAvatar,
  peerName,
  myName,
  onEnterRoomInvite,
  onRetry,
  onOpenProfile,
  onOpenOrder,
  onPreviewImage,
}: {
  item: ManagedMessage;
  peerAvatar: string | number;
  myAvatar: { uri: string } | number;
  peerName: string;
  myName: string;
  onEnterRoomInvite: (roomId: string, roomVersion: string) => void;
  onRetry: (clientId: string) => void;
  onOpenProfile?: () => void;
  onOpenOrder?: (orderId: string) => void;
  onPreviewImage: (message: ManagedMessage) => void;
}) {
  const { width: windowWidth } = useWindowDimensions();
  const [imageRatio, setImageRatio] = useState(1);
  const targetImageWidth = item.isMine ? 120 : 160;
  const imageWidth = Math.min(targetImageWidth, windowWidth * 0.58);
  const imageHeight = imageWidth / imageRatio;

  return (
    <View
      style={[
        styles.bubbleRow,
        item.isMine && styles.mineRow,
        (item.kind === "orderNotify" || item.kind === "csInvite") && !item.isMine && styles.orderNotifyMessageRow,
      ]}
    >
      {!item.isMine && (
        <Pressable
          accessibilityLabel="查看用户主页"
          accessibilityRole="button"
          disabled={!onOpenProfile}
          hitSlop={6}
          onPress={onOpenProfile}
        >
          <CachedImage
            contentFit="cover"
            source={peerAvatar}
            style={styles.messageAvatar}
          />
        </Pressable>
      )}
      <View
        style={[
          styles.bubble,
          item.isMine ? styles.mineBubble : styles.theirBubble,
          item.kind === "image" && styles.imageBubble,
          item.kind === "roomInvite" && styles.roomInviteBubble,
          (item.kind === "orderNotify" || item.kind === "csInvite") && styles.orderNotifyBubble,
          item.kind === "csInvite" && { maxWidth: Math.round(windowWidth * 0.68) },
        ]}
      >
        {item.kind === "image" ? (
          <Pressable
            accessibilityLabel="预览聊天图片"
            onPress={() => onPreviewImage(item)}
          >
            <CachedImage
              contentFit="contain"
              source={{ uri: item.imageUrl }}
              style={[
                styles.messageImage,
                { width: imageWidth, height: imageHeight },
              ]}
              onLoad={({ source }) => {
                if (source.width > 0 && source.height > 0) {
                  setImageRatio(source.width / source.height);
                }
              }}
            />
          </Pressable>
        ) : item.kind === "roomInvite" ? (
          <Pressable
            accessibilityLabel={`进入${item.isMine ? myName : peerName}分享的语聊房`}
            accessibilityRole="button"
            onPress={() => onEnterRoomInvite(item.roomId, item.roomVersion)}
            style={styles.roomInviteCard}
          >
            <View style={styles.roomInviteIconWrap}>
              <Image source={require("../../../../assets/message/room-invite.svg")} style={styles.roomInviteIcon} />
            </View>
            <View style={styles.roomInviteBody}>
              <Text numberOfLines={1} style={styles.roomInviteTitle}>语聊房邀请</Text>
              <View style={styles.roomInviteSender}>
                <CachedImage
                  contentFit="cover"
                  source={item.isMine ? myAvatar : peerAvatar}
                  style={styles.roomInviteAvatar}
                />
                <Text numberOfLines={1} style={styles.roomInviteName}>{item.isMine ? myName : peerName}</Text>
              </View>
            </View>
            <View style={styles.roomInviteButton}><Text style={styles.roomInviteButtonText}>进入</Text></View>
          </Pressable>
        ) : item.kind === "afterSale" ? (
          <View style={styles.afterSaleCard}>
            <View style={styles.afterSaleCardHeader}>
              <View style={styles.afterSaleCardIcon}>
                <HeadphonesRegular color="#FE1F4C" width={18} height={18} />
              </View>
              <Text style={styles.afterSaleCardTitle}>{item.title}</Text>
            </View>
            <View style={styles.afterSaleCardRows}>
              {afterSaleCardRows(item.payload).map((row) => (
                <View key={row.label} style={styles.afterSaleCardRow}>
                  <Text style={styles.afterSaleCardLabel}>{row.label}：</Text>
                  <Text
                    numberOfLines={row.label === "备注" ? 2 : undefined}
                    style={styles.afterSaleCardValue}
                  >
                    {row.value}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : item.kind === "orderNotify" ? (
          <OrderNotifyCard item={item} onOpenOrder={onOpenOrder} />
        ) : item.kind === "csInvite" ? (
          <CsInviteCard item={item} />
        ) : (
          <Text style={styles.bubbleText}>{item.text}</Text>
        )}
      </View>
      {item.isMine && (
        <CachedImage
          contentFit="cover"
          source={myAvatar}
          style={styles.messageAvatar}
        />
      )}
      {item.status === "failed" ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => onRetry(item.clientId || "")}
        >
          <Text style={styles.retryLabel}>重试</Text>
        </Pressable>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F7F7" },
  header: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#EBEBEB",
  },
  headerRow: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  headerButton: {
    width: 40,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerIcon: { width: 24, height: 24 },
  identity: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#EBEBEB",
  },
  name: {
    flexShrink: 1,
    color: "#333333",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 22,
  },
  onlineIcon: { width: 6, height: 6 },
  onlineText: { color: "#2FC273", fontFamily: DOUYIN_SANS, fontSize: 12 },
  offlineText: { color: "#999999" },
  messageList: {
    flexGrow: 1,
    paddingTop: 8,
    paddingBottom: 12,
  },
  orderAssistantEmpty: { flex: 1 },
  timeSeparator: {
    minHeight: 32,
    paddingVertical: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  timeSeparatorText: {
    color: "#999999",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    lineHeight: 18,
  },
  bubbleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  orderNotifyMessageRow: { paddingRight: 36 },
  mineRow: { justifyContent: "flex-end", paddingLeft: 36, paddingRight: 16 },
  messageAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#EBEBEB",
  },
  bubble: {
    maxWidth: "74%",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  theirBubble: { backgroundColor: "#FFFFFF" },
  mineBubble: { backgroundColor: "#FFF2F5" },
  retryLabel: {
    color: "#FE1F4C",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    marginLeft: 4,
    marginTop: 8,
  },
  errorBanner: {
    color: "#FE1F4C",
    backgroundColor: "#FFF1F3",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    lineHeight: 18,
    paddingHorizontal: 16,
    paddingVertical: 8,
    textAlign: "center",
  },
  bubbleText: {
    color: "#0A0A0A",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    lineHeight: 22,
  },
  imageBubble: {
    padding: 0,
    overflow: "hidden",
    backgroundColor: "transparent",
    borderWidth: 0,
  },
  roomInviteBubble: {
    maxWidth: "84%",
    padding: 0,
    backgroundColor: "transparent",
  },
  roomInviteCard: {
    width: 240,
    maxWidth: "100%",
    minHeight: 72,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  roomInviteIconWrap: {
    width: 42,
    height: 42,
    flexShrink: 0,
    borderRadius: 21,
    backgroundColor: "#FFF2F5",
    alignItems: "center",
    justifyContent: "center",
  },
  roomInviteIcon: { width: 21, height: 21 },
  roomInviteBody: { flex: 1, minWidth: 0, gap: 2 },
  roomInviteTitle: {
    color: "#0A0A0A",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "500",
  },
  roomInviteSender: { flexDirection: "row", alignItems: "center", gap: 4 },
  roomInviteAvatar: { width: 14, height: 14, borderRadius: 7 },
  roomInviteName: {
    flexShrink: 1,
    color: "#808080",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    lineHeight: 16,
  },
  roomInviteButton: {
    flexShrink: 0,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: "#FE1F4C",
  },
  roomInviteButtonText: {
    color: "#FFFFFF",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500",
  },
  messageImage: { backgroundColor: "transparent" },
  composer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingHorizontal: 12,
    paddingTop: 12,
    gap: 8,
  },
  input: {
    minHeight: 60,
    maxHeight: 120,
    backgroundColor: "#F7F7F7",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
    color: "#0A0A0A",
    fontSize: 14,
    lineHeight: 22,
    textAlignVertical: "top",
  },
  composerActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  toolButtons: { flexDirection: "row", gap: 16 },
  toolButton: { width: 24, height: 24 },
  toolButtonDisabled: { opacity: 0.45 },
  toolIcon: { width: 24, height: 24 },
  sendButton: {
    minWidth: 48,
    height: 24,
    borderRadius: 999,
    paddingHorizontal: 12,
    backgroundColor: "#FE1F4C",
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: { opacity: 0.55 },
  sendText: {
    color: "#FFFFFF",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    lineHeight: 18,
  },
  sendIcon: { width: 14, height: 14 },
  afterSaleGuide: {
    marginHorizontal: 12,
    marginBottom: 8,
    padding: 12,
    backgroundColor: "#FFF2F5",
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  afterSaleGuideCopy: { flex: 1, minWidth: 0 },
  afterSaleGuideTitle: { color: "#111", fontSize: 14, fontWeight: "600" },
  afterSaleGuideSub: { color: "#888", fontSize: 11, marginTop: 4 },
  afterSaleGuideButton: { color: "#FE1F4C", fontSize: 13, fontWeight: "600" },
  afterSaleGuideButtonDisabled: { opacity: 0.55 },
  afterSaleGuideClose: {
    width: 24,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  afterSaleGuideCloseText: { color: "#999", fontSize: 22, lineHeight: 24 },
  afterSaleCard: {
    width: 260,
    maxWidth: "100%",
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#F5F5F5",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E7E7E7",
    gap: 10,
  },
  afterSaleCardHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  afterSaleCardIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#FFE6EB",
    alignItems: "center",
    justifyContent: "center",
  },
  afterSaleCardTitle: {
    flex: 1,
    color: "#111",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  afterSaleCardRows: { gap: 4 },
  afterSaleCardRow: { flexDirection: "row", alignItems: "flex-start" },
  afterSaleCardLabel: {
    width: 48,
    color: "#888",
    fontSize: 11,
    lineHeight: 16,
  },
  afterSaleCardValue: { flex: 1, color: "#555", fontSize: 11, lineHeight: 16 },
  orderNotifyBubble: {
    flex: 1,
    minWidth: 0,
    maxWidth: "100%",
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  sheetBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
  },
  settingsSheet: {
    backgroundColor: "#F7F7F7",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  modalKeyboard: { flex: 1 },
  sheetTitleRow: {
    height: 56,
    paddingHorizontal: 16,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sheetTitle: {
    color: "#0A0A0A",
    fontFamily: DOUYIN_SANS,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "500",
  },
  sheetClose: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetCloseText: {
    color: "#CCCCCC",
    fontSize: 30,
    fontWeight: "300",
    lineHeight: 30,
  },
  sheetOptions: { paddingHorizontal: 12, paddingTop: 12, gap: 8 },
  sheetOption: {
    minHeight: 54,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sheetOptionText: {
    color: "#0A0A0A",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "500",
  },
  sheetOptionRight: {
    minWidth: 24,
    maxWidth: "70%",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sheetNote: {
    color: "#999999",
    fontFamily: DOUYIN_SANS,
    fontSize: 13,
    maxWidth: 160,
  },
  sheetArrow: { width: 16, height: 16 },
  switch: {
    width: 38,
    height: 20,
    borderRadius: 10,
    padding: 2,
    justifyContent: "center",
    backgroundColor: "#CCCCCC",
  },
  switchActive: { backgroundColor: "#FE1F4C" },
  switchKnob: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
  },
  switchKnobActive: { alignSelf: "flex-end" },
  noteBackdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },
  noteDialog: {
    width: "100%",
    maxWidth: 360,
    padding: 20,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
  },
  noteTitle: {
    color: "#0A0A0A",
    fontFamily: DOUYIN_SANS,
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 24,
  },
  noteInput: {
    height: 44,
    marginTop: 16,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#F7F7F7",
    color: "#0A0A0A",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
  },
  noteActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 16,
  },
  noteCancel: {
    minWidth: 64,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  noteCancelText: { color: "#666666", fontFamily: DOUYIN_SANS, fontSize: 14 },
  noteConfirm: {
    minWidth: 64,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    backgroundColor: "#FE1F4C",
  },
  noteConfirmText: {
    color: "#FFFFFF",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    fontWeight: "600",
  },
});
