import type { AfterSaleCardPayload } from "../order/after-sale-card";
import { AFTER_SALE_CARD_TITLE } from "../order/after-sale-card";

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

export type RoomInviteMessage = {
  id: string;
  kind: "roomInvite";
  roomId: string;
  roomVersion: string;
  time: string;
  isMine: boolean;
};

export type AfterSaleCardMessage = {
  id: string;
  kind: "afterSale";
  title: string;
  payload: Partial<AfterSaleCardPayload>;
  time: string;
  isMine: boolean;
};

export type OrderNotifyCardMessage = {
  id: string;
  kind: "orderNotify";
  title: string;
  orderId?: string;
  orderNo?: string;
  gameName?: string;
  serviceDesc?: string;
  numDesc?: string;
  totalPriceDesc?: string;
  createTime?: string;
  time: string;
  isMine: boolean;
};

export type ChatMessage = ChatTextMessage | ChatImageMessage | RoomInviteMessage | AfterSaleCardMessage | OrderNotifyCardMessage;

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
  identifier?: string;
  messageIdentifier?: string;
  objectName?: string;
  rawData?: string;
  name?: string;
  data?: string | Record<string, unknown>;
  fields?: Record<string, string | Record<string, unknown>>;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function parsePayload(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try { return asRecord(JSON.parse(value)); } catch { return {}; }
  }
  return asRecord(value);
}

function mergeCustomPayload(fields: Record<string, unknown>, payload: Record<string, unknown>) {
  const metadata = new Set(["name", "data", "identifier", "messageIdentifier"]);
  const businessFields = Object.fromEntries(Object.entries(fields).filter(([key]) => !metadata.has(key)));
  return { ...businessFields, ...payload };
}

export function parseRoomInviteLink(text: string): { roomId: string; roomVersion: string } | null {
  const match = text.trim().match(/^https?:\/\/[^/]+\/chat\?type=chat-room&id=(\d+)&v=(\d+)$/);
  if (!match) return null;
  return { roomId: match[1], roomVersion: match[2] };
}

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

  // Older native sessions return unregistered custom messages as rawData.
  const fields = { ...parsePayload(message.rawData), ...asRecord(message.fields) };
  // Server-persisted RC:CustomMsg uses fields.name + fields.data. Native
  // messages use identifier/messageIdentifier, so accept both SDK shapes.
  const customIdentifier = String(
    message.identifier
      || message.messageIdentifier
      || message.objectName
      || message.name
      || fields.identifier
      || fields.name
      || "",
  );
  // Commands are transient signals, not persisted chat content.
  if (customIdentifier === "RC:CmdMsg") return null;
  const customName = customIdentifier === "RC:CustomMsg" ? String(message.name || fields.name || "") : customIdentifier;
  const customPayload = parsePayload(message.data ?? fields.data);

  if (customName === "PZAfterSaleApply") {
    const payload = mergeCustomPayload(fields, customPayload) as Partial<AfterSaleCardPayload>;
    return { id, kind: "afterSale", title: AFTER_SALE_CARD_TITLE, payload, time, isMine };
  }

  if (customName === "ORDER_NOTIFY") {
    const payload = mergeCustomPayload(fields, customPayload);
    return {
      id,
      kind: "orderNotify",
      title: String(payload.title || "订单状态通知"),
      orderId: payload.orderId == null ? undefined : String(payload.orderId),
      orderNo: payload.orderNo == null ? undefined : String(payload.orderNo),
      gameName: payload.gameName == null ? undefined : String(payload.gameName),
      serviceDesc: payload.serviceDesc == null ? undefined : String(payload.serviceDesc),
      numDesc: payload.numDesc == null ? undefined : String(payload.numDesc),
      totalPriceDesc: payload.totalPriceDesc == null ? undefined : String(payload.totalPriceDesc),
      createTime: payload.createTime == null ? undefined : String(payload.createTime),
      time,
      isMine,
    };
  }

  // The SDK can unwrap RC:CustomMsg.data into fields instead of fields.data.
  const notificationText = customIdentifier === "RC:CustomMsg" || customName === "TEXT_NOTIFY_MSG"
    ? mergeCustomPayload(fields, customPayload).content
    : undefined;
  const text = message.text || message.content || (typeof notificationText === "string" ? notificationText : undefined);
  const roomInvite = text ? parseRoomInviteLink(text) : null;
  if (roomInvite) return { id, kind: "roomInvite", ...roomInvite, time, isMine };
  return text ? { id, kind: "text", text, time, isMine } : null;
}
