import { parseServerDateTime } from "@/shared/time/server-date";

/** 系统通知账号（SystemUserEnum.PLATFORM_NOTICE），命令信令的发送方 */
export const PLATFORM_NOTICE_USER_ID = "50000000";

export type QuickMatchNoticePayload = {
  requestNo: string;
  buyerNickname: string;
  gameName: string;
  modeName: string;
  levelName: string;
  serviceName: string;
  /** "yyyy-MM-dd HH:mm:ss"；NaN 表示不可解析 */
  expireAtMs: number;
};

export type QuickMatchExpiredPayload = {
  requestNo: string;
};

export type OrderNotifyPopupPayload = {
  title: string;
  orderId: string;
  orderNo: string;
  buyerNickname: string;
  buyerHeadImage: string;
};

/** 后端 RongMsgCommandEnum 全量命令名（含 PC 预留的 QUICK_MATCH_CANCELLED），未列入的命令会在分发处告警 */
export const KNOWN_RONG_COMMAND_NAMES = new Set<string>([
  "CUSTOMER_SERVICE_INVITE",
  "dispatchInvite",
  "QUICK_MATCH_NOTICE",
  "QUICK_MATCH_EXPIRED",
  "QUICK_MATCH_CANCELLED",
  "QUICK_MATCH_CREATED",
  "TEXT_NOTIFY_MSG",
  "ORDER_NOTIFY",
  "ROOM_KICKED",
]);

function stringField(data: Record<string, unknown>, key: string): string {
  const value = data[key];
  if (value == null) return "";
  return String(value);
}

export function parseQuickMatchNotice(
  data: Record<string, unknown>,
): QuickMatchNoticePayload | null {
  const requestNo = stringField(data, "requestNo");
  if (!requestNo) return null;
  return {
    requestNo,
    buyerNickname: stringField(data, "buyerNickname"),
    gameName: stringField(data, "gameName"),
    modeName: stringField(data, "modeName"),
    levelName: stringField(data, "levelName"),
    serviceName: stringField(data, "serviceName"),
    expireAtMs: parseServerDateTime(stringField(data, "expireTime")),
  };
}

export function parseQuickMatchExpired(
  data: Record<string, unknown>,
): QuickMatchExpiredPayload | null {
  const requestNo = stringField(data, "requestNo");
  if (!requestNo) return null;
  return { requestNo };
}

export function parseOrderNotifyPopup(
  data: Record<string, unknown>,
): OrderNotifyPopupPayload | null {
  const orderId = Number(data.orderId);
  if (!Number.isFinite(orderId) || orderId <= 0) return null;
  const orderNo = stringField(data, "orderNo");
  if (!orderNo) return null;
  return {
    title: stringField(data, "title"),
    orderId: String(orderId),
    orderNo,
    buyerNickname: stringField(data, "buyerNickname"),
    buyerHeadImage: stringField(data, "buyerHeadImage"),
  };
}
