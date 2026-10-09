export type ChatTextMessage = {
  id: string;
  kind: "text";
  text: string;
  time: string;
  isMine: boolean;
};

export type ChatImageMessage = {
  id: string;
  kind: "image";
  imageUrl: string;
  time: string;
  isMine: boolean;
};

export type ChatMessage = ChatTextMessage | ChatImageMessage;

export type RongSdkMessage = {
  messageType?: number;
  messageUId?: string;
  messageId?: number;
  sentTime?: number;
  senderUserId?: string;
  direction?: number;
  text?: string;
  content?: string;
  local?: string;
  remote?: string;
  mediaUrl?: string;
};

export function mapRongMessage(message: RongSdkMessage, enums: { image: number; send: number }): ChatMessage | null {
  const id = message.messageUId || String(message.messageId || `${message.sentTime}-${message.senderUserId}`);
  const time = message.sentTime
    ? new Date(message.sentTime).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
    : "";
  const isMine = message.direction === enums.send;

  if (message.messageType === enums.image) {
    const imageUrl = message.local || message.remote || message.mediaUrl;
    return imageUrl ? { id, kind: "image", imageUrl, time, isMine } : null;
  }

  const text = message.text || message.content;
  return text ? { id, kind: "text", text, time, isMine } : null;
}
