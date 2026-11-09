import { useAuthStore } from "@esports/auth";
import {
  ChevronLeft24Regular,
  ChevronRight16Regular,
  HeadphonesRegular,
} from "@fluentui/react-native-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  BackHandler,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  PixelRatio,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputContentSizeChangeEventData,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EmojiKeyboard, type EmojiType } from "rn-emoji-keyboard";

import type { AfterSaleCardPayload } from "@/features/order/after-sale-card";
import { afterSaleCardRows } from "@/features/order/after-sale-card";
import { beginMediaPick } from "@/shared/media-picker/media-picker-session";
import { convertToJpeg, isGifImage } from "@/shared/media-picker/image-compat";
import { showToast } from "@/shared/ui/app-toast";
import { useAppConfirm } from "@/shared/ui/app-confirm";
import { EmptyState } from "@/shared/ui/AsyncStates";
import { BottomSheet } from "@/shared/ui/BottomSheet";
import { CachedImage } from "@/shared/ui/CachedImage";
import { enterRoomFromInvite } from "@/features/voice-room/enter-room-from-invite";
import { CsInviteCard } from "./CsInviteCard";
import { MarkdownMessage } from "./MarkdownMessage";
import { OrderNotifyCard } from "./OrderNotifyCard";
import { openChatImagePreviewSession } from "../chat-image-preview-session";
import { touchCustomerServiceSession } from "../customer-service.api";
import { resolveConversationAvatar } from "../message-avatar";
import type { ManagedMessage } from "../message-state";
import { messageStore, useMessageStore } from "../message-store";
import { useOnlineStatusPolling } from "../hooks/use-online-status-polling";
import { getConversationDisplayTitle } from "../message-title";
import {
  getSystemConversationTitle,
  isOrderAssistantConversationId,
  isSelfConversationId,
  isSystemConversationId,
  normalizeSystemConversationId,
} from "../system-conversations";

// 聊天单次发送图片数量上限（相册多选防刷屏）
const CHAT_IMAGE_MAX = 10;
/** 输入框行高与最大行数：默认 44（单行 22 + 上下内边距 11），超过 4 行内部滚动 */
const COMPOSER_LINE_HEIGHT = 22;
const COMPOSER_MAX_CONTENT_HEIGHT = COMPOSER_LINE_HEIGHT * 4;

const defaultAvatar = require("../../../../assets/images/avatar_default.webp");
const defaultMyAvatar = require("../../../../assets/mine/mine-avatar.png");
const chatMore = require("../../../../assets/svgs/chat-more.svg");
const chatOnline = require("../../../../assets/svgs/chat-online.svg");
const chatOffline = require("../../../../assets/svgs/chat-offline.svg");
const chatClose = require("../../../../assets/svgs/icon-close.svg");
const chatEmoji = require("../../../../assets/svgs/chat-emoji.svg");
const chatPhoto = require("../../../../assets/svgs/chat-photo.svg");
const chatSend = require("../../../../assets/svgs/chat-send.svg");
const systemNotificationAvatar = require("../../../../assets/svgs/message-system-notice.svg");
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
      !previousMessage ||
      message.sentAt - previousMessage.sentAt > 5 * 60 * 1000;
    return [
      ...(showTime
        ? [
            {
              key: `time-${message.id}`,
              kind: "time" as const,
              label: formatMessageTimeSeparator(message.sentAt),
            },
          ]
        : []),
      { key: message.id, kind: "message" as const, message },
    ];
  });
}

type ChatConversationProps = {
  conversationId: string;
  title?: string;
  avatar?: string;
  clubId?: string;
  /** 仅聊天页使用：售后引导卡参数 */
  afterSale?: string;
  /** 仅聊天页使用：客服会话标记 */
  customerService?: string;
  /** 仅聊天页使用：是否从个人主页进入（影响查看主页的返回行为） */
  fromProfile?: string;
  /** page=聊天页全屏；sheet=底部弹窗（语聊房内拉起） */
  presentation?: "page" | "sheet";
  /** 页面聚焦 / 弹窗可见时为 true，驱动已读前台状态与在线状态刷新 */
  active?: boolean;
  /** 返回按钮回调；页面模式默认 router.back() */
  onBack?: () => void;
  /** 关闭按钮回调（仅弹窗模式右上角 ×） */
  onClose?: () => void;
  /** 弹窗模式：跳转原生路由前先收起弹窗；restorable=返回后可恢复弹窗（切房为 false 不恢复） */
  onBeforeNavigate?: (restorable: boolean) => void;
  /** 弹窗模式：相册选图结束后重新拉起弹窗 */
  onAfterPickImages?: () => void;
  /** 弹窗模式：表情面板打开时注册返回键拦截（关面板吞事件），避免 Modal 的返回键直接关掉整层弹窗丢草稿 */
  backInterceptorRef?: { current: (() => boolean) | null };
};

export function ChatConversation({
  conversationId: rawConversationId,
  title,
  avatar,
  clubId,
  afterSale,
  customerService,
  fromProfile,
  presentation = "page",
  active = false,
  onBack,
  onClose,
  onBeforeNavigate,
  onAfterPickImages,
  backInterceptorRef,
}: ChatConversationProps) {
  const isSheet = presentation === "sheet";
  const insets = useSafeAreaInsets();
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
  const conversationId = normalizeSystemConversationId(String(rawConversationId || ""));
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
    () =>
      isPeerBlacklisted
        ? messages.filter((message) => message.isMine)
        : messages,
    [isPeerBlacklisted, messages],
  );
  const chatRows = useMemo(
    () => buildChatListRows(visibleMessages).slice().reverse(),
    [visibleMessages],
  );
  const connectionState = useMessageStore((state) => state.connectionState);
  const lastError = useMessageStore((state) => state.lastError);
  const openConversation = useMessageStore((state) => state.openConversation);
  const closeConversation = useMessageStore((state) => state.closeConversation);
  const sendText = useMessageStore((state) => state.sendText);
  const sendImage = useMessageStore((state) => state.sendImage);
  const resolveImagePreview = useMessageStore(
    (state) => state.resolveImagePreview,
  );
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
  // 刚进入时 openConversation 尚未创建历史记录（首帧），也要按加载中处理，避免空态文案闪现
  const historyPending =
    historyState === undefined && connectionState === "ready";
  const conversationBaseTitle = getSystemConversationTitle(
    conversationId,
    (customerService === "1" ? title : conversation?.title) ||
      title ||
      "用户聊天",
  );
  const isCustomerService =
    customerService === "1" || conversation?.isCustomerService === true;
  const conversationTitle = getConversationDisplayTitle(
    conversationId,
    conversationBaseTitle,
    conversation?.note,
  );
  const conversationAvatar = resolveConversationAvatar(
    avatar || conversation?.avatar,
    isSystemConversationId(conversationId)
      ? systemNotificationAvatar
      : defaultAvatar,
    conversationId,
  );
  const myAvatar = useMemo(
    () => (myAvatarUrl ? { uri: myAvatarUrl } : defaultMyAvatar),
    [myAvatarUrl],
  );
  // 对端在线状态优先取轮询结果（不依赖会话行是否已进列表），缺省按离线展示，
  // 避免会话还没拉到状态时整块在线信息不渲染
  const peerOnlineFromPolling = useMessageStore(
    (state) => state.peerOnlineById[conversationId],
  );
  const peerOnline = peerOnlineFromPolling ?? conversation?.isOnline === true;

  // 聊天页可见期间立即查一次并持续轮询当前对端的在线状态
  // （列表页失焦后由本页接管，只查该对端）
  useOnlineStatusPolling(
    active && !isSystemConversationId(conversationId),
    accessToken,
    conversationId,
  );

  // 前后台/覆盖与 openConversation 的 activePeerId 解耦：页面被覆盖或退后台时
  // activePeerId 仍在，但必须退出"已读"状态，否则新消息未读会被静默清零。
  const [appStateActive, setAppStateActive] = useState(
    AppState.currentState === "active",
  );
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      setAppStateActive(state === "active");
    });
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    messageStore.getState().setChatForeground(active && appStateActive);
    return () => messageStore.getState().setChatForeground(false);
  }, [active, appStateActive]);

  const isOrderAssistant = isOrderAssistantConversationId(conversationId);
  const isPinned = Boolean(conversation?.isPinned);
  // 系统会话没有输入框，加大列表底部留白，避免最后一条消息贴屏幕底不利查看
  const isSystemConversation = isSystemConversationId(conversationId);
  // 弹窗内 safe-area inset 在 Android Modal 下可能取不到，兜底保证输入条不贴屏幕底
  const bottomInset = isSheet
    ? Math.max(insets.bottom, 28)
    : insets.bottom;
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
  const handleSendText = useCallback(
    async (text: string) => {
      if (isSelfConversation) {
        return;
      }
      scrollToLatest();
      await sendText(conversationId, text);
      if (isCustomerService && accessToken) {
        await touchCustomerServiceSession(accessToken).catch(() => undefined);
      }
    },
    [
      accessToken,
      conversationId,
      isCustomerService,
      isSelfConversation,
      scrollToLatest,
      sendText,
    ],
  );
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
  // 弹窗模式下 Modal 会盖住 push 出来的原生路由页，跳转前必须先收起弹窗；
  // restorable 标记返回语聊房后能否恢复弹窗（进入其它房间不恢复）
  const navigateWithSheetDismiss = useCallback(
    (navigate: () => void, restorable = true) => {
      if (isSheet) onBeforeNavigate?.(restorable);
      navigate();
    },
    [isSheet, onBeforeNavigate],
  );
  const openOrderDetail = useCallback((orderId: string) => {
    navigateWithSheetDismiss(() => {
      router.push({ pathname: "/order/[id]", params: { id: orderId } });
    });
  }, [navigateWithSheetDismiss]);
  const openImagePreview = useCallback(
    async (message: ManagedMessage) => {
      try {
        const resolvedUri = await resolveImagePreview(message);
        // 连看列表：当前会话全部图片消息按时间序组装，点开哪张定位到哪张；
        // 其余图片滑到前后页时再按消息对象逐张下载（融云远端地址直连会 401）
        const imageMessages = visibleMessages.filter(
          (item): item is Extract<ManagedMessage, { kind: "image" }> =>
            item.kind === "image",
        );
        const index = Math.max(
          0,
          imageMessages.findIndex((item) => item.id === message.id),
        );
        // 预览是独立路由页，消息对象经内存会话带过去，不再用 URL 字符串反查
        const sessionId = openChatImagePreviewSession({
          messages: imageMessages,
          index,
          resolvedUri,
        });
        navigateWithSheetDismiss(() => {
          router.push({
            pathname: "/image-preview",
            params: { previewSessionId: sessionId },
          });
        });
      } catch (error) {
        void useAppConfirm.getState().confirm({
        title: "图片预览失败",
        message: error instanceof Error ? error.message : "融云图片下载失败",
      });
      }
    },
    [navigateWithSheetDismiss, resolveImagePreview, visibleMessages],
  );
  const openProfile = useCallback(() => {
    setSettingsVisible(false);
    if (!/^\d+$/.test(conversationId)) {
      void useAppConfirm.getState().confirm({
        title: "暂无法查看主页",
        message: "当前会话缺少主页信息，请从用户主页重新发起聊天。",
      });
      return;
    }
    const targetClubId =
      clubId ||
      conversation?.clubId ||
      (afterSalePayload?.clubId ? String(afterSalePayload.clubId) : undefined);
    const profileHref = {
      pathname: "/profile" as const,
      params: {
        ...(targetClubId ? { clubId: String(targetClubId) } : {}),
        userId: conversationId,
      },
    };
    // expo-router fork 的 StackRouter 对深层 NAVIGATE 不做弹回去重（仅栈顶同名才合并），
    // 会造成 主页→聊天→主页 无限套娃；从主页进的聊天，主页必然在栈中，
    // 用 dismissTo（POP_TO）弹回栈内已有主页；其他入口栈里没有主页，仍用 push
    if (!isSheet && fromProfile === "1") {
      navigateWithSheetDismiss(() => router.dismissTo(profileHref));
      return;
    }
    navigateWithSheetDismiss(() => router.push(profileHref));
  }, [
    afterSalePayload,
    clubId,
    conversation,
    conversationId,
    fromProfile,
    isSheet,
    navigateWithSheetDismiss,
  ]);
  const renderChatRow = useCallback(
    ({ item }: { item: ChatListRow }) =>
      item.kind === "time" ? (
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
          onEnterRoomInvite={(roomId, roomVersion) => {
            // 切房后原会话不再恢复弹窗
            navigateWithSheetDismiss(() => {
              void enterRoomFromInvite(roomId, roomVersion);
            }, false);
          }}
          onRetry={handleRetryMessage}
          onOpenProfile={canViewProfile ? openProfile : undefined}
          onOpenOrder={isOrderAssistant ? openOrderDetail : undefined}
          onPreviewImage={openImagePreview}
        />
      ),
    [
      canViewProfile,
      conversation?.title,
      conversationAvatar,
      handleRetryMessage,
      isOrderAssistant,
      myAvatar,
      myNickname,
      navigateWithSheetDismiss,
      openImagePreview,
      openOrderDetail,
      openProfile,
      title,
    ],
  );

  useEffect(() => {
    isNearBottom.current = true;
    return () => {
      if (scrollFrame.current !== null)
        cancelAnimationFrame(scrollFrame.current);
      scrollFrame.current = null;
    };
  }, [conversationId]);

  // onBack 由外部传入且常是内联函数（每次渲染新引用），经 ref 读取，
  // 避免它进入下方 openConversation effect 的 deps 造成 close/open 反复触发
  const onBackRef = useRef(onBack);
  useEffect(() => {
    onBackRef.current = onBack;
  }, [onBack]);

  useEffect(() => {
    if (isSelfConversation) {
      if (isSheet) {
        onBackRef.current?.();
      } else {
        router.back();
      }
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
        ...(isCustomerService ? { isCustomerService: true } : {}),
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
    isCustomerService,
    isSelfConversation,
    isSheet,
    openConversation,
  ]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      // Native content anchoring can emit a scroll before our requested scroll runs.
      if (scrollFrame.current !== null) return;
      isNearBottom.current = event.nativeEvent.contentOffset.y <= 48;
    },
    [],
  );

  const handleLoadOlder = useCallback(() => {
    if (!historyLoading) void loadOlder(conversationId);
  }, [conversationId, historyLoading, loadOlder]);

  const handleScrollBeginDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (scrollFrame.current !== null)
        cancelAnimationFrame(scrollFrame.current);
      scrollFrame.current = null;
      isNearBottom.current = event.nativeEvent.contentOffset.y <= 48;
    },
    [],
  );

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

  // 弹窗模式：头部返回也要先问表情面板拦截器（面板开着只收面板，避免误关整层丢草稿）
  const handleBack = isSheet
    ? () => {
        if (backInterceptorRef?.current?.()) return;
        onBack?.();
      }
    : () => router.back();

  if (isSelfConversation) return null;

  const header = (
    <View
      style={[
        styles.header,
        isSheet ? styles.headerSheet : { paddingTop: insets.top },
      ]}
    >
      <View
        style={[
          styles.headerRow,
          isSheet && styles.headerRowSheet,
          !isSheet && styles.headerRowPage,
        ]}
      >
        <Pressable
          accessibilityLabel="返回"
          accessibilityRole="button"
          hitSlop={8}
          onPress={handleBack}
          style={styles.headerButton}
        >
          <ChevronLeft24Regular
            color="#1A1A1A"
            width={24}
            height={24}
            style={styles.headerIcon}
          />
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
          {!isSystemConversationId(conversationId) ? (
            <View style={styles.onlineStatus}>
              <Image
                source={peerOnline ? chatOnline : chatOffline}
                style={styles.onlineIcon}
              />
              <Text
                style={[styles.onlineText, !peerOnline && styles.offlineText]}
              >
                {peerOnline ? "在线中" : "离线"}
              </Text>
            </View>
          ) : null}
        </View>
        <Pressable
          accessibilityLabel="更多功能"
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => setSettingsVisible(true)}
          style={[styles.headerButton, !isSheet && styles.headerMoreButton]}
        >
          <Image
            source={chatMore}
            style={[styles.headerIcon, !isSheet && styles.headerMoreIcon]}
          />
        </Pressable>
        {isSheet ? (
          <Pressable
            accessibilityLabel="关闭聊天"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onClose}
            style={styles.headerButton}
          >
            <Image source={chatClose} style={styles.headerCloseIcon} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );

  const body = (
    <View
      style={[
        styles.screen,
        isSheet ? styles.screenSheet : null,
      ]}
    >
      {header}
      <FlatList
        key={conversationId}
        ref={listRef}
        inverted
        contentContainerStyle={[
          styles.messageList,
          isSystemConversation && styles.messageListSystem,
        ]}
        data={chatRows}
        keyExtractor={(item) => item.key}
        ListEmptyComponent={
          isOrderAssistant ? (
            historyLoading || historyPending ? (
              <View style={styles.orderAssistantLoading}>
                <ActivityIndicator color="#FE1F4C" />
              </View>
            ) : (
              <EmptyState
                message="暂无订单消息"
                style={styles.orderAssistantEmpty}
              />
            )
          ) : null
        }
        renderItem={renderChatRow}
        showsVerticalScrollIndicator={false}
        // 聊天行大多带图，收窄挂载窗口可减少同时挂载、同时解码的图片数量
        initialNumToRender={8}
        maxToRenderPerBatch={6}
        windowSize={7}
        onContentSizeChange={keepLatestVisible}
        onLayout={keepLatestVisible}
        maintainVisibleContentPosition={{
          minIndexForVisible: 0,
          autoscrollToTopThreshold: 48,
        }}
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

      {!isSystemConversation ? (
        <ChatComposer
          variant={presentation}
          bottomInset={bottomInset}
          backInterceptorRef={backInterceptorRef}
          onSendText={handleSendText}
          onSendImage={handleSendImage}
          onBeforeNavigate={navigateWithSheetDismiss}
          onAfterPickImages={onAfterPickImages}
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
                onPress={() => {
                  void setConversationPinned(conversationId, !isPinned);
                }}
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
                <ChevronRight16Regular
                  color="#0A0A0A"
                  width={16}
                  height={16}
                  style={styles.sheetArrow}
                />
              </View>
            </Pressable>
            {canViewProfile ? (
              <Pressable
                accessibilityRole="button"
                onPress={openProfile}
                style={styles.sheetOption}
              >
                <Text style={styles.sheetOptionText}>查看个人主页</Text>
                <ChevronRight16Regular
                  color="#0A0A0A"
                  width={16}
                  height={16}
                  style={styles.sheetArrow}
                />
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
              {
                paddingTop: insets.top + 24,
                paddingBottom: insets.bottom + 24,
              },
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
    </View>
  );

  if (isSheet) return body;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
      style={styles.screen}
    >
      {body}
    </KeyboardAvoidingView>
  );
}

const ChatComposer = memo(function ChatComposer({
  variant,
  bottomInset,
  backInterceptorRef,
  onSendText,
  onSendImage,
  onBeforeNavigate,
  onAfterPickImages,
}: {
  variant: "page" | "sheet";
  bottomInset: number;
  /** 弹窗模式：表情面板打开时注册返回键拦截 */
  backInterceptorRef?: { current: (() => boolean) | null };
  onSendText: (text: string) => Promise<void>;
  onSendImage: (imageUri: string) => Promise<void>;
  onBeforeNavigate?: (navigate: () => void) => void;
  onAfterPickImages?: () => void;
}) {
  const isSheet = variant === "sheet";
  const [draft, setDraft] = useState("");
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [imageSending, setImageSending] = useState(false);
  // 输入区内容高度（不含内边距）：单行 22，随输入行数增高，封顶 4 行后内部滚动
  const [inputContentHeight, setInputContentHeight] = useState(
    COMPOSER_LINE_HEIGHT,
  );
  const handleInputContentSizeChange = (
    event: NativeSyntheticEvent<TextInputContentSizeChangeEventData>,
  ) => {
    const nextHeight = Math.min(
      Math.max(event.nativeEvent.contentSize.height, COMPOSER_LINE_HEIGHT),
      COMPOSER_MAX_CONTENT_HEIGHT,
    );
    setInputContentHeight(nextHeight);
  };

  // 弹窗模式：键盘弹出后输入条已被顶到键盘上方，底部安全区留白要撤掉，否则键盘与输入条间多一截灰条
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  useEffect(() => {
    if (isSheet) {
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
    }
  }, [isSheet]);

  useEffect(() => {
    if (!isSheet && emojiPickerOpen && Platform.OS === "android") {
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          setEmojiPickerOpen(false);
          return true;
        },
      );
      return () => subscription.remove();
    }
  }, [emojiPickerOpen, isSheet]);

  // 弹窗模式：表情面板开着时按返回键应只收面板；Modal 会拦走全局 BackHandler，
  // 这里把拦截器挂到上层（ChatSheet 的 onRequestClose）去处理
  useEffect(() => {
    if (!isSheet || !emojiPickerOpen) return;
    const ref = backInterceptorRef;
    if (!ref) return;
    ref.current = () => {
      setEmojiPickerOpen(false);
      return true;
    };
    return () => {
      ref.current = null;
    };
  }, [backInterceptorRef, emojiPickerOpen, isSheet]);

  const selectEmoji = useCallback((emoji: EmojiType) => {
    setDraft((current) => `${current}${emoji.emoji}`);
    setEmojiPickerOpen(false);
  }, []);

  const sendMessage = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    setInputContentHeight(COMPOSER_LINE_HEIGHT);
    await onSendText(text);
  };

  const pickImage = async () => {
    if (imageSending) return;
    setEmojiPickerOpen(false);
    // 相册选择页内部处理权限，选图结果经会话桥接回传；上限 10 张防止刷屏
    const pickPending = beginMediaPick();
    // 弹窗模式下选图页是路由页，必须先收起弹窗；选图结束回到弹窗再发送
    onBeforeNavigate?.(() => {
      router.push({
        pathname: "/media-picker",
        params: { max: String(CHAT_IMAGE_MAX) },
      });
    });
    const picked = await pickPending;
    // 无论选没选都要先恢复弹窗，取消选图也不能让弹窗消失
    onAfterPickImages?.();
    if (!picked?.length) return;

    setImageSending(true);
    let failed = 0;
    try {
      // 逐张发送保持顺序；静态图重编码为 JPEG 并把最长边压到 1080（与融云默认压缩后的尺寸一致，
      // 避免原图上传过大的文件）。GIF 重编码会丢动画，原样发送
      for (const uri of picked) {
        try {
          const sendUri = isGifImage(uri) ? uri : await convertToJpeg(uri, 0.85, 1080);
          await onSendImage(sendUri);
        } catch {
          failed += 1;
        }
      }
    } finally {
      setImageSending(false);
    }
    if (failed > 0) {
      showToast(`${failed}张图片发送失败，请重试`);
    }
  };

  const emojiPanel = emojiPickerOpen ? (
    <View style={[styles.emojiPanel, { height: 340 + bottomInset + 10 }]}>
      <EmojiKeyboard
        categoryPosition="bottom"
        disableSafeArea
        enableRecentlyUsed
        hideHeader
        onEmojiSelected={selectEmoji}
        styles={{
          container: {
            paddingBottom: bottomInset + 10,
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
  ) : null;

  if (isSheet) {
    // 弹窗模式按设计稿（1829-78203）：单行白色输入条 + 相册/表情图标，键盘发送键提交
    // 键盘弹出时输入条已贴键盘，底部安全区留白归零
    const sheetComposerPaddingBottom = emojiPickerOpen
      ? 12
      : keyboardVisible
        ? 0
        : bottomInset;
    return (
      <View
        style={[
          styles.composer,
          styles.composerSheet,
          { paddingBottom: sheetComposerPaddingBottom },
        ]}
      >
        <View style={styles.composerSheetBar}>
          <View style={styles.inputWrapSheet}>
            <TextInput
              accessibilityLabel="输入消息"
              multiline
              onContentSizeChange={handleInputContentSizeChange}
              onChangeText={setDraft}
              onFocus={() => setEmojiPickerOpen(false)}
              onSubmitEditing={() => void sendMessage()}
              placeholder="发个消息吧～"
              placeholderTextColor="#CCCCCC"
              returnKeyType="send"
              style={[styles.input, { height: inputContentHeight }]}
              submitBehavior="submit"
              value={draft}
            />
          </View>
          <Pressable
            accessibilityLabel="图片"
            accessibilityRole="button"
            disabled={imageSending}
            hitSlop={8}
            onPress={() => void pickImage()}
            style={[
              styles.toolButton,
              styles.toolButtonSheet,
              imageSending && styles.toolButtonDisabled,
            ]}
          >
            <Image source={chatPhoto} style={styles.toolIcon} />
          </Pressable>
          <Pressable
            accessibilityLabel="表情"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => {
              Keyboard.dismiss();
              setEmojiPickerOpen((current) => !current);
            }}
            style={[styles.toolButton, styles.toolButtonSheet]}
          >
            <Image source={chatEmoji} style={styles.toolIcon} />
          </Pressable>
        </View>
        {emojiPanel}
      </View>
    );
  }

  return (
    <>
      <View
        style={[
          styles.composer,
          { paddingBottom: emojiPickerOpen ? 12 : Math.max(bottomInset, 16) },
        ]}
      >
        <View style={styles.inputWrapPage}>
          <TextInput
            accessibilityLabel="输入消息"
            multiline
            onContentSizeChange={handleInputContentSizeChange}
            onChangeText={setDraft}
            onFocus={() => setEmojiPickerOpen(false)}
            placeholder="输入消息"
            placeholderTextColor="#CCCCCC"
            style={[styles.input, { height: inputContentHeight }]}
            value={draft}
          />
        </View>
        <View style={styles.composerActions}>
          <View style={styles.toolButtons}>
            <Pressable
              accessibilityLabel="表情"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => {
                Keyboard.dismiss();
                setEmojiPickerOpen((current) => !current);
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
      {/* 表情面板参与页面布局，打开时与系统键盘一样顶起输入框和消息列表 */}
      {emojiPanel}
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
  const knownRatio = item.kind === "image" ? item.imageAspectRatio : undefined;
  const [loadedRatio, setLoadedRatio] = useState<number | null>(null);
  // 消息自带宽高比优先用于首帧，避免先按 1:1 排版、解码后再回弹（每张图多一次布局和一次解码）
  const imageRatio = loadedRatio ?? knownRatio ?? 1;
  const targetImageWidth = item.isMine ? 120 : 160;
  const imageWidth = Math.min(targetImageWidth, windowWidth * 0.58);
  const imageHeight = imageWidth / imageRatio;
  // 本会话自己发出的 GIF 原图是本地文件，用原图播放动效；融云缩略图是静态 JPEG，用了就不动了。
  // 远端 GIF（对方发的）拿不到本地文件，仍先用缩略图，点开预览再看动图
  const [animatedImageUri] = useState(() => {
    if (item.kind !== "image" || !/^(?:file|content):\/\//i.test(item.imageUrl)) {
      return null;
    }
    return isGifImage(item.imageUrl) ? item.imageUrl : null;
  });
  // 缩略图宽度不足以铺满气泡的物理像素时会被放大发虚，这种消息继续用原图（解码尺寸由图片库按气泡缩小）
  const isThumbnailSharpEnough = item.kind === "image"
    && !!item.thumbnailUri
    && (item.thumbnailWidth ?? 0) >= imageWidth * PixelRatio.get();
  const bubbleImageUri = item.kind === "image"
    ? (animatedImageUri ?? (isThumbnailSharpEnough ? item.thumbnailUri! : item.imageUrl))
    : "";

  return (
    <View
      style={[
        styles.bubbleRow,
        item.isMine && styles.mineRow,
        (item.kind === "orderNotify" || item.kind === "csInvite") &&
          !item.isMine &&
          styles.orderNotifyMessageRow,
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
          (item.kind === "orderNotify" || item.kind === "csInvite") &&
            styles.orderNotifyBubble,
          item.kind === "csInvite" && {
            maxWidth: Math.round(windowWidth * 0.68),
          },
        ]}
      >
        {item.kind === "image" ? (
          <Pressable
            accessibilityLabel="预览聊天图片"
            onPress={() => onPreviewImage(item)}
          >
            <CachedImage
              contentFit="contain"
              // 缩略图够清晰才用，省下原图的解码内存；不够清晰就回退原图，避免气泡发虚
              source={{ uri: bubbleImageUri }}
              style={[
                styles.messageImage,
                { width: imageWidth, height: imageHeight },
              ]}
              onLoad={({ source }) => {
                if (source.width <= 0 || source.height <= 0) {
                  return;
                }
                const next = source.width / source.height;
                // 与消息自带比例相差不到 1% 就沿用，避免为亚像素差异再触发一次布局
                if (knownRatio && Math.abs(next - knownRatio) / knownRatio < 0.01) {
                  return;
                }
                setLoadedRatio(next);
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
              <Image
                source={require("../../../../assets/svgs/room-invite.svg")}
                style={styles.roomInviteIcon}
              />
            </View>
            <View style={styles.roomInviteBody}>
              <Text numberOfLines={1} style={styles.roomInviteTitle}>
                语聊房邀请
              </Text>
              <View style={styles.roomInviteSender}>
                <CachedImage
                  contentFit="cover"
                  source={item.isMine ? myAvatar : peerAvatar}
                  style={styles.roomInviteAvatar}
                />
                <Text numberOfLines={1} style={styles.roomInviteName}>
                  {item.isMine ? myName : peerName}
                </Text>
              </View>
            </View>
            <View style={styles.roomInviteButton}>
              <Text style={styles.roomInviteButtonText}>进入</Text>
            </View>
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
        ) : item.kind === "markdown" ? (
          <MarkdownMessage content={item.text} />
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
  // 弹窗模式底色按设计稿 Gray-03 #F5F6F7
  screenSheet: { backgroundColor: "#F5F6F7" },
  header: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#EBEBEB",
  },
  headerSheet: { borderBottomColor: "#E9E9EB" },
  headerRow: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  // 弹窗头部按设计稿高 56，右上角多一个关闭按钮
  headerRowSheet: { height: 56 },
  // 页面头部按设计稿 nav/middle-title 右侧留白 16（更多按钮图标贴右边）
  headerRowPage: { paddingRight: 16 },
  headerButton: {
    width: 40,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  // 设计稿更多图标为 32×32，按钮与图标同宽，右侧留白 16
  headerMoreButton: { width: 32 },
  headerMoreIcon: { width: 32, height: 32 },
  headerIcon: { width: 24, height: 24 },
  headerCloseIcon: { width: 32, height: 32 },
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
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 22,
  },
  onlineStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  onlineIcon: { width: 6, height: 6 },
  onlineText: { color: "#2FC273", fontSize: 12 },
  offlineText: { color: "#999999" },
  messageList: {
    flexGrow: 1,
    // 倒序列表中布局的 flex-end 映射为视觉顶部：内容不满一屏时从顶部开始展示
    justifyContent: "flex-end",
    paddingTop: 8,
    paddingBottom: 12,
  },
  // 倒序列表中 paddingTop 落在屏幕底部（最新消息一侧）；系统会话无输入框，用大留白替代
  messageListSystem: { paddingTop: 48 },
  orderAssistantEmpty: { flex: 1 },
  orderAssistantLoading: { flex: 1, alignItems: "center", justifyContent: "center" },
  timeSeparator: {
    minHeight: 32,
    paddingVertical: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  timeSeparatorText: {
    color: "#999999",
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
    fontSize: 12,
    marginLeft: 4,
    marginTop: 8,
  },
  errorBanner: {
    color: "#FE1F4C",
    backgroundColor: "#FFF1F3",
    fontSize: 12,
    lineHeight: 18,
    paddingHorizontal: 16,
    paddingVertical: 8,
    textAlign: "center",
  },
  bubbleText: {
    color: "#0A0A0A",
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
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "500",
  },
  roomInviteSender: { flexDirection: "row", alignItems: "center", gap: 4 },
  roomInviteAvatar: { width: 14, height: 14, borderRadius: 7 },
  roomInviteName: {
    flexShrink: 1,
    color: "#808080",
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
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500",
  },
  messageImage: { backgroundColor: "transparent" },
  composer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingTop: 12,
    gap: 8,
  },
  // 弹窗模式输入区按设计稿：底部浅灰区 + 单行白色输入条
  composerSheet: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    backgroundColor: "#F7F7F7",
    paddingTop: 8,
    // 弹窗内输入条左右留白 12
    paddingHorizontal: 12,
    gap: 8,
  },
  // 弹窗模式输入条：单行 44 高，多行时随内容增高；图标贴底部对齐（仿微信）
  composerSheetBar: {
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    gap: 12,
  },
  // 页面模式输入框外壳：44 = 单行 22 + 上下内边距 11；左右留白 12
  inputWrapPage: {
    backgroundColor: "#F7F7F7",
    borderRadius: 8,
    marginHorizontal: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  inputWrapSheet: { flex: 1, paddingVertical: 11 },
  input: {
    padding: 0,
    color: "#0A0A0A",
    fontSize: 14,
    lineHeight: 22,
    textAlignVertical: "top",
  },
  // 图标与单行文本垂直居中：底部留 10（44 条内 (44-24)/2）
  toolButtonSheet: { marginBottom: 10 },
  emojiPanel: { backgroundColor: "#FFFFFF" },
  // 表情/相册/发送按钮行左右留白 12
  composerActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
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
  noteCancelText: { color: "#666666", fontSize: 14 },
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
    fontSize: 14,
    fontWeight: "600",
  },
});
