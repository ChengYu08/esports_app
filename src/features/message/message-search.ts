import type { MessageConversation } from "./message-state";

export function filterMessageConversations(
  conversations: MessageConversation[],
  keyword: string,
): MessageConversation[] {
  const normalizedKeyword = keyword.trim().toLocaleLowerCase();
  if (!normalizedKeyword) return conversations;

  return conversations.filter((conversation) =>
    [conversation.title, conversation.id].some((value) =>
      value.toLocaleLowerCase().includes(normalizedKeyword),
    ),
  );
}
