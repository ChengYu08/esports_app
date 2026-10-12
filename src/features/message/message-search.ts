import type { MessageConversation } from "./message-state";
import { getSystemConversationTitle, normalizeSystemConversationId } from "./system-conversations";

export function filterMessageConversations(
  conversations: MessageConversation[],
  keyword: string,
): MessageConversation[] {
  const normalizedKeyword = keyword.trim().toLocaleLowerCase();
  if (!normalizedKeyword) return conversations;

  return conversations.filter((conversation) =>
    [conversation.title, conversation.note, getSystemConversationTitle(conversation.id, ""), conversation.id, normalizeSystemConversationId(conversation.id)].filter((value): value is string => Boolean(value)).some((value) =>
      value.toLocaleLowerCase().includes(normalizedKeyword),
    ),
  );
}
