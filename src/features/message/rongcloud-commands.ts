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
  /** 活动编码：非空即活动通知；普通通知后端不输出 → undefined */
  activityCode?: string;
  /** 活动类型：用于选择具体活动样式/通知标题，当前固定 ACTIVITY_BASED_DISPATCHING */
  activityType?: string;
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

/** 可选字符串字段：trim 后为空归 undefined（活动通知字段，普通通知后端不输出） */
function optionalStringField(data: Record<string, unknown>, key: string): string | undefined {
  const value = stringField(data, key).trim();
  if (!value) return undefined;
  return value;
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
    activityCode: optionalStringField(data, "activityCode"),
    activityType: optionalStringField(data, "activityType"),
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
