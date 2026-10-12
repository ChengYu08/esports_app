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
  orderNo?: string;
  gameName?: string;
  serviceDesc?: string;
  numDesc?: string;
  totalPriceDesc?: string;
  createTime?: string;
  time: string;
  isMine: boolean;
};

export type ChatMessage = ChatTextMessage | ChatImageMessage | AfterSaleCardMessage | OrderNotifyCardMessage;

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
  fields?: Record<string, string>;
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

  if (message.identifier === "PZAfterSaleApply") {
    let fields = message.fields || {};
    let payload: Partial<AfterSaleCardPayload> = fields;
    try { payload = JSON.parse(fields.data || "{}"); } catch { /* use fields */ }
    return { id, kind: "afterSale", title: AFTER_SALE_CARD_TITLE, payload, time, isMine };
  }

  if (message.identifier === "ORDER_NOTIFY") {
    let fields = message.fields || {};
    let payload: Record<string, string> = fields;
    try { payload = JSON.parse(fields.data || "{}"); } catch { /* use fields */ }
    return {
      id,
      kind: "orderNotify",
      title: payload.title || "订单状态通知",
      orderNo: payload.orderNo,
      gameName: payload.gameName,
      serviceDesc: payload.serviceDesc,
      numDesc: payload.numDesc,
      totalPriceDesc: payload.totalPriceDesc,
      createTime: payload.createTime,
      time,
      isMine,
    };
  }

  const text = message.text || message.content;
  return text ? { id, kind: "text", text, time, isMine } : null;
}
