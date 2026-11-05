import type { VoiceRoomMessage } from './voice-room.types';

/** 缓存条目上限，与屏内消息列表 slice(-80) 保持一致 */
const MAX_CACHED_MESSAGES = 80;

/**
 * 语聊房消息会话级缓存（chatroomId → 消息列表）。
 *
 * 屏内消息列表是组件 state，最小化（返回其他页面）会卸载屏组件导致记录丢失；
 * 而融云 getChatRoomMessages 依赖聊天室消息云存储（需服务端开通）。
 * 因此消息在模块层按聊天室缓存：屏内 setMessages 同步写入，融云分发层在
 * 屏幕卸载期间持续追加，重进房间时整体恢复。真正退房（leaveVoiceChatRoom）时清空。
 */
const chatroomMessages = new Map<string, VoiceRoomMessage[]>();

export function getCachedVoiceChatMessages(chatroomId: string): VoiceRoomMessage[] {
  return chatroomMessages.get(chatroomId) ?? [];
}

export function setCachedVoiceChatMessages(chatroomId: string, messages: VoiceRoomMessage[]) {
  chatroomMessages.set(chatroomId, messages.slice(-MAX_CACHED_MESSAGES));
}

/** 屏幕卸载期间由融云分发层调用；按消息 id 去重，防止重复投递 */
export function appendCachedVoiceChatMessage(chatroomId: string, message: VoiceRoomMessage) {
  const current = chatroomMessages.get(chatroomId) ?? [];
  if (current.some((item) => item.id === message.id)) return;
  setCachedVoiceChatMessages(chatroomId, [...current, message]);
}

export function clearVoiceChatMessageCache(chatroomId: string) {
  chatroomMessages.delete(chatroomId);
}
