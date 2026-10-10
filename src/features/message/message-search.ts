import type { MessageConversation } from "./message-state";
import { getSystemConversationTitle, normalizeSystemConversationId } from "./system-conversations";

export function filterMessageConversations(
  conversations: MessageConversation[],
  keyword: string,
): MessageConversation[] {
  const normalizedKeyword = keyword.trim().toLocaleLowerCase();
  if (!normalizedKeyword) return conversations;

  return conversations.filter((conversation) =>
    [conversation.title, getSystemConversationTitle(conversation.id, ""), conversation.id, normalizeSystemConversationId(conversation.id)].some((value) =>
      value.toLocaleLowerCase().includes(normalizedKeyword),
    ),
  );
}
