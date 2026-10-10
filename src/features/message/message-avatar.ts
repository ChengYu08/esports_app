import { isSystemConversationId } from "./system-conversations";

const ORDER_ASSISTANT_TITLE = "订单助手";

export function resolveConversationAvatar(title: string, avatar: string | undefined, defaultAvatar: number, conversationId?: string) {
  if (conversationId && isSystemConversationId(conversationId)) return defaultAvatar;
  return title.trim() === ORDER_ASSISTANT_TITLE ? defaultAvatar : avatar || defaultAvatar;
}
