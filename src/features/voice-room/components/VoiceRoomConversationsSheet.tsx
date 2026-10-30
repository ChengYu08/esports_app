import { useAuthStore } from "@esports/auth";
import { router } from "expo-router";
import { useEffect, useMemo } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmptyState } from "@/shared/ui/AsyncStates";
import { BottomSheet } from "@/shared/ui/BottomSheet";
import {
  getConversationAvatarUri,
  resolveConversationAvatar,
} from "@/features/message/message-avatar";
import { useMessageStore } from "@/features/message/message-store";
import { isVisibleMessageConversation } from "@/features/message/message-unread";
import { getConversationDisplayTitle } from "@/features/message/message-title";
import { MessageListItem } from "@/features/message/components/MessageListItem";
import type { MessageListItemModel } from "@/features/message/message.types";
import {
  isSelfConversationId,
  isSystemConversationId,
} from "@/features/message/system-conversations";

const defaultConversationAvatar = require("../../../../assets/coms/avatar_default.webp");

type VoiceRoomConversationsSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** When set, tapping a conversation sends this text to the peer instead of opening the chat screen. */
  sendTextTo?: (peerId: string) => Promise<void>;
};

/**
 * Bottom sheet listing RongCloud private conversations, opened from the
 * voice room toolbar message button. Tapping an entry opens the chat screen.
 */
export function VoiceRoomConversationsSheet({
  visible,
  onClose,
  sendTextTo,
}: VoiceRoomConversationsSheetProps) {
  const insets = useSafeAreaInsets();
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
        .filter(
          (item) =>
            isVisibleMessageConversation(item, userId, blacklistedUserIds) &&
            !isSystemConversationId(item.id),
        )
        .map((item) => {
          const avatar = resolveConversationAvatar(
            item.avatar,
            defaultConversationAvatar,
          );
          return {
            ...item,
            id: item.id,
            title: getConversationDisplayTitle(item.id, item.title, item.note),
            kind: "conversation" as const,
            avatar: typeof avatar === "string" ? { uri: avatar } : avatar,
          };
        }),
    [blacklistedUserIds, conversations, userId],
  );

  const handlePress = (item: MessageListItemModel) => {
    if (isSelfConversationId(item.id, userId)) return;
    if (sendTextTo) {
      void sendTextTo(item.id);
      onClose();
      return;
    }
    const avatarUri = getConversationAvatarUri(item.avatar);
    onClose();
    router.push({
      pathname: "/chat/[id]",
      params: {
        id: item.id,
        title: item.title,
        clubId: item.clubId || "",
        ...(avatarUri ? { avatar: avatarUri } : {}),
      },
    });
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} contentStyle={styles.sheet}>
      <View style={[styles.header, { paddingTop: 16 }]}>
        <Text style={styles.title}>私聊消息</Text>
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
          contentContainerStyle={{ paddingBottom: insets.bottom + 8 }}
        />
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
    maxHeight: "70%",
  },
  header: {
    alignItems: "center",
    paddingBottom: 12,
  },
  title: {
    color: "#161823",
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
  },
  empty: { height: 240, justifyContent: "center" },
});
