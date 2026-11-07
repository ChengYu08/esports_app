import type { AfterSaleCardPayload } from "../order/after-sale-card";
import { AFTER_SALE_CARD_TITLE } from "../order/after-sale-card";

export type ChatTextMessage = {
  id: string;
  kind: "text";
  text: string;
  time: string;
  isMine: boolean;
};

export type ChatMarkdownMessage = {
  id: string;
  kind: "markdown";
  text: string;
  time: string;
  isMine: boolean;
};

export type ChatImageMessage = {
  id: string;
  kind: "image";
  imageUrl: string;
  /** 融云缩略图 data URI：尺寸够气泡显示时才用，原图仅在点开预览时使用 */
  thumbnailUri?: string;
  /** 缩略图宽度（像素），用来判断放大到气泡尺寸后会不会发虚 */
  thumbnailWidth?: number;
  /** 融云消息自带的宽高比；气泡首帧按它定尺寸，避免先按 1:1 排版再回弹 */
  imageAspectRatio?: number;
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

export const CS_INVITE_CARD_TITLE = "接待邀请";

export type CsInviteCardMessage = {
  id: string;
  kind: "csInvite";
  roomId: string;
  clubId: string;
  roomVersion: string;
  playerUserId?: string;
  playerName?: string;
  /** Unix seconds，与后端 CustomerServiceInviteCommand.expireAt 一致 */
  expireAt?: number;
  rongChatroomId?: string;
  rtcChannelName?: string;
  time: string;
  isMine: boolean;
};

export type ChatMessage = ChatTextMessage | ChatMarkdownMessage | ChatImageMessage | RoomInviteMessage | AfterSaleCardMessage | OrderNotifyCardMessage | CsInviteCardMessage;

export function messagePreview(message: ChatMessage): string {
  switch (message.kind) {
    case "image":
      return "[图片]";
    case "roomInvite":
      return "[语聊房邀请]";
    case "afterSale":
    case "orderNotify":
      return message.title;
    case "csInvite":
      return "[接待邀请]";
    case "markdown":
      // 与 Web 端一致：摘要剥掉 markdown 标记只留纯文本，空内容回退为 [通知]。
      return message.text.replace(/[*_~`#>]+/g, "").trim() || "[通知]";
    case "text":
      return message.text;
  }
}

/**
 * 从原始消息数组中取 sentTime 最新的一条，映射成列表预览 + 时间。
 * 会话壳（目录同步恢复、无 lastMessage）用它从云端补拉的最后一条消息生成真实预览，
 * 避免列表误显"新消息"。最新一条不可映射时返回 null。
 */
export function latestMessagePreview(
  messages: RongSdkMessage[],
  enums: { image: number; send: number },
): { preview: string; time: string } | null {
  const newest = [...messages].sort((left, right) => (right.sentTime || 0) - (left.sentTime || 0))[0];
  if (!newest) return null;
  const mapped = mapRongMessage(newest, enums);
  if (!mapped) return null;
  return { preview: messagePreview(mapped), time: mapped.time };
}

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
  thumWidth?: number;
  thumHeight?: number;
  thumbnailBase64String?: string;
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

/** 融云给的是裸 base64，拼成 data URI 供图片组件直接渲染；空值表示该消息没有缩略图 */
function toThumbnailUri(base64?: string): string | undefined {
  if (!base64) {
    return undefined;
  }
  return base64.startsWith("data:") ? base64 : `data:image/jpeg;base64,${base64}`;
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
    if (!imageUrl) {
      return null;
    }
    // 缩略图宽高必定与原图同比，可直接当作气泡宽高比；缺失时交给 onLoad 兜底
    const hasThumbSize = !!message.thumWidth && !!message.thumHeight
      && message.thumWidth > 0 && message.thumHeight > 0;
    return {
      id,
      kind: "image",
      imageUrl,
      thumbnailUri: toThumbnailUri(message.thumbnailBase64String),
      thumbnailWidth: hasThumbSize ? message.thumWidth : undefined,
      imageAspectRatio: hasThumbSize ? message.thumWidth! / message.thumHeight! : undefined,
      time,
      isMine,
    };
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

  if (customName === "dispatchInvite") {
    const payload = mergeCustomPayload(fields, customPayload);
    const roomId = payload.roomId == null ? "" : String(payload.roomId);
    const clubId = payload.clubId == null ? "" : String(payload.clubId);
    const roomVersion = payload.roomVersion == null ? "" : String(payload.roomVersion);
    if (!roomId || !clubId || !roomVersion) return null;
    const expireAt = Number(payload.expireAt);
    return {
      id,
      kind: "csInvite",
      roomId,
      clubId,
      roomVersion,
      playerUserId: payload.playerUserId == null ? undefined : String(payload.playerUserId),
      playerName: payload.playerName == null ? undefined : String(payload.playerName),
      expireAt: Number.isFinite(expireAt) ? expireAt : undefined,
      rongChatroomId: payload.rongChatroomId == null ? undefined : String(payload.rongChatroomId),
      rtcChannelName: payload.rtcChannelName == null ? undefined : String(payload.rtcChannelName),
      time,
      isMine,
    };
  }

  // The SDK can unwrap RC:CustomMsg.data into fields instead of fields.data.
  const isCustomNotification = customIdentifier === "RC:CustomMsg" || customName === "TEXT_NOTIFY_MSG";
  const notificationText = isCustomNotification
    ? mergeCustomPayload(fields, customPayload).content
    : undefined;
  const text = message.text || message.content || (typeof notificationText === "string" ? notificationText : undefined);
  // 平台通知等自定义消息与 Web 端一致，按 markdown 渲染（纯文本是 markdown 子集）。
  if (isCustomNotification && text) return { id, kind: "markdown", text, time, isMine };
  const roomInvite = text ? parseRoomInviteLink(text) : null;
  if (roomInvite) return { id, kind: "roomInvite", ...roomInvite, time, isMine };
  return text ? { id, kind: "text", text, time, isMine } : null;
}
