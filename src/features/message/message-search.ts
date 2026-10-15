import type { MessageConversation } from "./message-state";
import {
  getSystemConversationTitle,
  isSelfConversationId,
  isSystemConversationId,
  normalizeSystemConversationId,
} from "./system-conversations";

export function filterMessageConversations(
  conversations: MessageConversation[],
  keyword: string,
  userId?: string | null,
  blacklistedUserIds: readonly string[] = [],
): MessageConversation[] {
  const blacklisted = new Set(blacklistedUserIds);
  const visibleConversations = conversations.filter((conversation) =>
    !isSelfConversationId(conversation.id, userId)
    && (isSystemConversationId(conversation.id)
      || !blacklisted.has(normalizeSystemConversationId(conversation.id))),
  );
  const normalizedKeyword = keyword.trim().toLocaleLowerCase();
  if (!normalizedKeyword) return visibleConversations;

  return visibleConversations.filter((conversation) =>
    [conversation.title, conversation.note, getSystemConversationTitle(conversation.id, ""), conversation.id, normalizeSystemConversationId(conversation.id)].filter((value): value is string => Boolean(value)).some((value) =>
      value.toLocaleLowerCase().includes(normalizedKeyword),
    ),
  );
}
