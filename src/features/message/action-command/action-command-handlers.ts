import type { RongCommand } from "@/features/message/rongcloud-command";
import {
  parseOrderNotifyPopup,
  parseQuickMatchExpired,
  parseQuickMatchNotice,
  PLATFORM_NOTICE_USER_ID,
} from "@/features/message/rongcloud-commands";
import type { QuickMatchNoticeBarInvite } from "@/features/match/quick-match-invite-bar-store";

import type { OrderPayDialogData } from "./action-command-store";

const QUICK_MATCH_NOTICE = "QUICK_MATCH_NOTICE";
const QUICK_MATCH_EXPIRED = "QUICK_MATCH_EXPIRED";
const QUICK_MATCH_CANCELLED = "QUICK_MATCH_CANCELLED";
const ORDER_NOTIFY = "ORDER_NOTIFY";
const MAX_QUICK_MATCH_DURATION_MS = 30_000;

type QuickMatchEndReason = "expired" | "cancelled";

const QUICK_MATCH_END_REASON: Record<string, QuickMatchEndReason> = {
  [QUICK_MATCH_EXPIRED]: "expired",
  [QUICK_MATCH_CANCELLED]: "cancelled",
};

export type QuickMatchEndActions = {
  notifyEnded: (requestNo: string, reason: QuickMatchEndReason) => void;
  /** 撤掉对应 requestNo 的抢单通知条（若正在展示） */
  dismissQuickMatchBar: (requestNo: string) => void;
};

/**
 * QUICK_MATCH_EXPIRED / QUICK_MATCH_CANCELLED：写终止信号（消费方按自身 requestNo 自门控）
 * 并撤掉对应的抢单通知条。发送方为平台通知、收件人为老板，但按 requestNo 分发即可。
 */
export function handleQuickMatchExpired(
  command: RongCommand,
  actions: QuickMatchEndActions,
) {
  const reason = QUICK_MATCH_END_REASON[command.name];
  if (!reason) return;
  if (command.senderId !== PLATFORM_NOTICE_USER_ID) return;

  const payload = parseQuickMatchExpired(command.data);
  if (!payload) return;

  actions.notifyEnded(payload.requestNo, reason);
  actions.dismissQuickMatchBar(payload.requestNo);
}

/** 抢单通知去重：requestNo（弹窗消失时释放，允许同需求极端重推再提示） */
const quickMatchNoticeKeys = new Set<string>();
/** 支付催单弹窗去重：orderNo（仅手动关闭/接单成功时释放，防止关了又弹） */
const orderPayKeys = new Set<string>();

function buildQuickMatchMessage(payload: {
  buyerNickname: string;
  gameName: string;
  modeName: string;
  levelName: string;
  serviceName: string;
}) {
  const buyer = payload.buyerNickname || "老板";
  const serviceText = [
    payload.gameName,
    payload.modeName,
    payload.levelName,
    payload.serviceName,
  ]
    .map((part) => part.trim())
    .filter(Boolean)
    .join("·");
  if (!serviceText) return `「${buyer}」发布了快速匹配需求`;
  return `「${buyer}」发布 ${serviceText} 需求`;
}

export function handleQuickMatchNotice(
  command: RongCommand,
  show: (invite: QuickMatchNoticeBarInvite) => void,
  now = Date.now(),
) {
  if (command.name !== QUICK_MATCH_NOTICE) return;
  if (command.senderId !== PLATFORM_NOTICE_USER_ID) return;

  const payload = parseQuickMatchNotice(command.data);
  if (!payload) return;
  if (quickMatchNoticeKeys.has(payload.requestNo)) return;

  const expireAt = Number.isFinite(payload.expireAtMs)
    ? payload.expireAtMs
    : now + MAX_QUICK_MATCH_DURATION_MS;
  if (expireAt - now <= 0) return;

  quickMatchNoticeKeys.add(payload.requestNo);
  show({
    key: `qm:${payload.requestNo}`,
    requestNo: payload.requestNo,
    text: buildQuickMatchMessage(payload),
    expireAt,
  });
}

export function handleOrderNotifyPopup(
  command: RongCommand,
  show: (data: OrderPayDialogData) => void,
) {
  if (command.name !== ORDER_NOTIFY) return;
  if (command.senderId !== PLATFORM_NOTICE_USER_ID) return;

  const payload = parseOrderNotifyPopup(command.data);
  if (!payload) return;
  if (orderPayKeys.has(payload.orderNo)) return;

  orderPayKeys.add(payload.orderNo);
  show({
    key: `pay:${payload.orderNo}`,
    orderId: payload.orderId,
    orderNo: payload.orderNo,
    title: payload.title,
    buyerNickname: payload.buyerNickname,
    ...(payload.buyerHeadImage ? { buyerHeadImage: payload.buyerHeadImage } : {}),
  });
}

/** 抢单弹窗消失（到期/忽略/抢单成功）时释放去重键 */
export function releaseQuickMatchNoticeKey(requestNo: string) {
  quickMatchNoticeKeys.delete(requestNo);
}

/** 支付催单弹窗仅手动关闭/接单成功时释放 */
export function releaseOrderPayKey(orderNo: string) {
  orderPayKeys.delete(orderNo);
}

/** 测试专用：清空去重键 */
export function resetActionCommandDedupKeys() {
  quickMatchNoticeKeys.clear();
  orderPayKeys.clear();
}
