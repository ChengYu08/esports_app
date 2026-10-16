import {
  isSelfConversationId,
  isSystemConversationId,
  normalizeSystemConversationId,
} from "./system-conversations";

export function formatUnreadCount(count: number) {
  if (count <= 0) return "";
  return count > 99 ? "99+" : String(count);
}

type UnreadConversation = { id: string; unreadCount: number };

export function isVisibleMessageConversation(
  conversation: UnreadConversation,
  userId: string | undefined,
  blacklistedUserIds: string[],
) {
  const id = normalizeSystemConversationId(conversation.id);
  return !isSelfConversationId(id, userId)
    && (isSystemConversationId(id) || !blacklistedUserIds.includes(id));
}

export function sumVisibleUnreadCount(
  conversations: UnreadConversation[],
  userId: string | undefined,
  blacklistedUserIds: string[],
) {
  return conversations.reduce(
    (total, conversation) => isVisibleMessageConversation(conversation, userId, blacklistedUserIds)
      ? total + conversation.unreadCount
      : total,
    0,
  );
}
