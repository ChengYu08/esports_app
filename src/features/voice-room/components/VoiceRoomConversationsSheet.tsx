import { useAuthStore } from "@esports/auth";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmptyState } from "@/shared/ui/AsyncStates";
import { showToast } from "@/shared/ui/app-toast";
import { BottomSheet } from "@/shared/ui/BottomSheet";
import { resolveConversationAvatar } from "@/features/message/message-avatar";
import { useMessageStore } from "@/features/message/message-store";
import { isVisibleMessageConversation } from "@/features/message/message-unread";
import { getConversationDisplayTitle } from "@/features/message/message-title";
import { MessageListItem } from "@/features/message/components/MessageListItem";
import type { MessageListItemModel } from "@/features/message/message.types";
import {
  isSelfConversationId,
  isSystemConversationId,
  normalizeSystemConversationId,
} from "@/features/message/system-conversations";

const defaultConversationAvatar = require("../../../../assets/images/avatar_default.webp");
const systemNotificationAvatar = require("../../../../assets/svgs/message-system-notice.svg");
const chatClose = require("../../../../assets/svgs/icon-close.svg");

/** BottomSheet 关闭动画约 220ms，成功 Toast 须在 Modal 卸载后再挂到根节点，否则会随 Sheet 一起消失 */
const TOAST_AFTER_SHEET_MS = 280;

type VoiceRoomConversationsSheetProps = {
  visible: boolean;
  onClose: () => void;
  /**
   * When set, tapping a conversation sends invite text instead of opening chat.
   * Resolve `true` when invite is sent; sheet shows success toast after close.
   */
  sendTextTo?: (peerId: string) => Promise<boolean>;
  /** 点击会话回调（私聊模式）：由外部拉起聊天弹窗 */
  onOpenConversation?: (item: MessageListItemModel) => void;
};

/**
 * Bottom sheet listing RongCloud private conversations, opened from the
 * voice room toolbar message button. Tapping an entry opens the chat sheet
 * via `onOpenConversation` (or sends invite text in invite mode).
 */
export function VoiceRoomConversationsSheet({
  visible,
  onClose,
  sendTextTo,
  onOpenConversation,
}: VoiceRoomConversationsSheetProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [pressedClose, setPressedClose] = useState(false);
  const accessToken = useAuthStore((state) => state.accessToken);
  const userId = useAuthStore((state) => state.user?.id);
  const connectionState = useMessageStore((state) => state.connectionState);
  const conversations = useMessageStore((state) => state.conversations);
  const blacklistedUserIds = useMessageStore((state) => state.blacklistedUserIds);
  const refreshConversations = useMessageStore((state) => state.refreshConversations);

  // Reuse the message store session; refresh silently when opening.
  useEffect(() => {
    if (visible && accessToken && connectionState === "idle") {
      void refreshConversations(accessToken);
    }
  }, [visible, accessToken, connectionState, refreshConversations]);

  const items = useMemo<MessageListItemModel[]>(
    () =>
      conversations
        .filter((item) =>
          isVisibleMessageConversation(item, userId, blacklistedUserIds),
        )
        .map((item) => {
          const id = normalizeSystemConversationId(item.id);
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
            title: getConversationDisplayTitle(id, item.title, item.note),
            kind: "conversation" as const,
            avatar: typeof avatar === "string" ? { uri: avatar } : avatar,
          };
        }),
    [blacklistedUserIds, conversations, userId],
  );

  // 稳定回调：MessageListItem 是 memo 组件，引用变化会导致整列表重渲
  const handlePress = useCallback(
    (item: MessageListItemModel) => {
      if (isSelfConversationId(item.id, userId)) return;
      if (sendTextTo) {
        // 先发完再关 Sheet：失败留 Sheet 以免错误 Toast 随 Modal 卸载；成功延后 Toast 到根节点
        void (async () => {
          const sent = await sendTextTo(item.id);
          if (!sent) return;
          onClose();
          setTimeout(() => showToast("邀请已发送"), TOAST_AFTER_SHEET_MS);
        })();
        return;
      }
      if (onOpenConversation) {
        onOpenConversation(item);
        return;
      }
      onClose();
    },
    [onClose, onOpenConversation, sendTextTo, userId],
  );

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      contentStyle={[
        styles.sheet,
        // 设计稿弹层 690/812 ≈ 85% 屏高
        { height: Math.round(windowHeight * 0.85) },
      ]}
    >
      <View style={styles.header}>
        <Text style={styles.title}>消息</Text>
        <Pressable
          accessibilityLabel="关闭消息列表"
          accessibilityRole="button"
          hitSlop={8}
          onPress={onClose}
          onPressIn={() => setPressedClose(true)}
          onPressOut={() => setPressedClose(false)}
          style={styles.closeButton}
        >
          <Image
            source={chatClose}
            style={[styles.closeIcon, pressedClose && styles.closeIconPressed]}
          />
        </Pressable>
      </View>
      {items.length === 0 ? (
        <View style={styles.empty}>
          <EmptyState message="暂无私聊消息" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <MessageListItem
              item={item}
              isLast={index === items.length - 1}
              onPress={handlePress}
            />
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingBottom: Math.max(insets.bottom, 16) + 8,
          }}
        />
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    overflow: "hidden",
  },
  // 设计稿（551-126006）：标题「消息」左对齐 + 右上角关闭按钮
  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 16,
    paddingRight: 12,
  },
  title: {
    flex: 1,
    color: "#0A0A0A",
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "500",
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  closeIcon: { width: 32, height: 32 },
  closeIconPressed: { opacity: 0.5 },
  empty: { height: 240, justifyContent: "center" },
});
