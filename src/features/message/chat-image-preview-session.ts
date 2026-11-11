import type { ManagedMessage } from "./message-state";

export type ChatImagePreviewMessage = Extract<ManagedMessage, { kind: "image" }>;

export type ChatImagePreviewSession = {
  id: string;
  /** 打开预览时的全部图片消息，按聊天里的时间序 */
  messages: ChatImagePreviewMessage[];
  /** 点开的那张在 messages 里的下标 */
  index: number;
  /** 点开时已解析好的地址（本地文件或已下载的原图） */
  resolvedUri: string;
};

// 预览接口是路由页，没法直接传消息对象；用内存表把消息带到预览页，
// 避免靠 URL 字符串反查（库被清空或地址不一致时会退化成直连远端地址 401）
const sessions = new Map<string, ChatImagePreviewSession>();
let seed = 0;

export function openChatImagePreviewSession(
  session: Omit<ChatImagePreviewSession, "id">,
): string {
  seed += 1;
  const id = `chat-image-${seed}`;
  sessions.set(id, { ...session, id });
  return id;
}

export function readChatImagePreviewSession(
  id: string | undefined,
): ChatImagePreviewSession | null {
  if (!id) {
    return null;
  }
  return sessions.get(id) ?? null;
}

export function closeChatImagePreviewSession(id: string) {
  sessions.delete(id);
}
