import dispatchAssistantAvatar from "../../../assets/images/dispatch-assistant.png";
import orderAssistantAvatar from "../../../assets/message/order-assistant.svg";
import {
  isDispatchAssistantConversationId,
  isOrderAssistantConversationId,
  isSystemConversationId,
} from "./system-conversations";

export const ORDER_ASSISTANT_AVATAR = orderAssistantAvatar;
export const DISPATCH_ASSISTANT_AVATAR = dispatchAssistantAvatar;

export function resolveConversationAvatar(
  avatar: string | undefined,
  defaultAvatar: number,
  conversationId?: string,
) {
  if (isOrderAssistantConversationId(conversationId)) return ORDER_ASSISTANT_AVATAR;
  if (isDispatchAssistantConversationId(conversationId)) return DISPATCH_ASSISTANT_AVATAR;
  if (conversationId && isSystemConversationId(conversationId)) return defaultAvatar;
  return avatar || defaultAvatar;
}

export function getConversationAvatarUri(source: unknown): string | undefined {
  if (typeof source === "string") return source;
  if (!source || typeof source !== "object" || !("uri" in source)) return undefined;
  return typeof source.uri === "string" ? source.uri : undefined;
}
