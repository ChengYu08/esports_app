import { logger } from "@/core/logging/logger";
import { showToast } from "@/shared/ui/app-toast";
import { useAuthStore } from "@esports/auth";
import { router } from "expo-router";

import { grabQuickMatchAndEnterAudition } from "@/features/match/grab-quick-match-flow";
import type { RongCommand } from "@/features/message/rongcloud-command";
import {
  parseOrderNotifyPopup,
  parseQuickMatchExpired,
  parseQuickMatchNotice,
  PLATFORM_NOTICE_USER_ID,
} from "@/features/message/rongcloud-commands";
import { refreshDispatchForRemoteChange } from "@/features/order/order-query";
import { acceptOrder } from "@/features/order/order.api";
import { formatServerDateTime } from "@/shared/time/server-date";
import { actionNotice } from "@/shared/ui/action-notice/action-notice-store";
import { TRADE_NOTICE_ICON } from "@/shared/ui/action-notice/trade-notice-icon";

const QUICK_MATCH_NOTICE = "QUICK_MATCH_NOTICE";
const QUICK_MATCH_EXPIRED = "QUICK_MATCH_EXPIRED";
const QUICK_MATCH_CANCELLED = "QUICK_MATCH_CANCELLED";
const ORDER_NOTIFY = "ORDER_NOTIFY";
const ACTIVITY_ROOM_NOTICE = "ACTIVITY_ROOM_NOTICE";
/** 活动房通知 Toast 时长，与 PC MessagePlugin.info duration 对齐 */
const ACTIVITY_ROOM_NOTICE_TOAST_MS = 10000;
const MAX_ACTION_NOTICE_DURATION_MS = 15_000;
/** 离线消息重放门控：命令通知比这更旧视为离线积压，不弹条（超过即为离线重放） */
const COMMAND_STALE_MAX_MS = 15 * 60_000;

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

  void refreshDispatchForRemoteChange();
  actions.notifyEnded(payload.requestNo, reason);
  actions.dismissQuickMatchBar(payload.requestNo);
}

/** 抢单通知去重：requestNo:notifyRound（账号会话内永久，登出清空） */
const quickMatchNoticeKeys = new Set<string>();
/** 支付催单去重：orderNo（条消失时释放，防止关了又弹） */
const orderPayKeys = new Set<string>();

function buildQuickMatchMessage(payload: {
  buyerNickname: string;
  gameName: string;
}) {
  const buyer = payload.buyerNickname || "老板";
  const game = payload.gameName.trim();
  if (!game) return `「${buyer}」发布了快速匹配需求`;
  return `「${buyer}」发布了${game}需求`;
}

/**
 * 活动通知文案：带「秒杀」语境前缀（PRD 要求标题体现活动语境，当前仅秒杀）。
 * 普通通知（activityCode 为空）不走这里，保持原文案零变化。
 */
function buildActivityQuickMatchMessage(payload: {
  buyerNickname: string;
  gameName: string;
}) {
  const base = buildQuickMatchMessage(payload);
  return `秒杀匹配中：${base}`;
}

function buildOrderPayMessage(buyerNickname: string) {
  return `「${buyerNickname || "老板"}」已支付订单，请尽快接单`;
}

export function handleQuickMatchNotice(command: RongCommand, now = Date.now()) {
  if (command.name !== QUICK_MATCH_NOTICE) return;
  if (command.senderId !== PLATFORM_NOTICE_USER_ID) return;

  const payload = parseQuickMatchNotice(command.data);
  if (!payload) {
    logger.warn("QUICK_MATCH_NOTICE 缺少 requestNo", {
      senderId: command.senderId,
    });
    return;
  }

  const expired =
    Number.isFinite(payload.expireAtMs) && payload.expireAtMs - now <= 0;
  const stale =
    command.sentTime != null &&
    now - command.sentTime > COMMAND_STALE_MAX_MS;
  logger.info("QUICK_MATCH_NOTICE", {
    requestNo: payload.requestNo,
    expired,
    stale,
    missingFields: Number.isFinite(payload.expireAtMs) ? "" : "expireTime",
    expireAt: Number.isFinite(payload.expireAtMs)
      ? formatServerDateTime(payload.expireAtMs)
      : undefined,
    sentTime:
      command.sentTime != null
        ? formatServerDateTime(command.sentTime)
        : undefined,
  });

  // 无论是否弹条（重复/已过期/离线重放）都让派单中心失效：可见时立即重拉，否则下次进入再拉
  void refreshDispatchForRemoteChange();
  const notifyKey = `${payload.requestNo}:${payload.notifyRound}`;
  if (quickMatchNoticeKeys.has(notifyKey)) return;
  if (stale) return;

  const expireAt = Number.isFinite(payload.expireAtMs)
    ? payload.expireAtMs
    : now + MAX_ACTION_NOTICE_DURATION_MS;
  if (expireAt - now <= 0) return;

  const noticeId = `qm:${payload.requestNo}:${payload.notifyRound}`;
  quickMatchNoticeKeys.add(notifyKey);
  // 活动语境文案：仅 activityCode 非空时切换标题；跳转链路与普通通知完全一致
  const text = payload.activityCode
    ? buildActivityQuickMatchMessage(payload)
    : buildQuickMatchMessage(payload);
  actionNotice.push(
    {
      id: noticeId,
      text,
      actionText: "去抢单",
      icon: TRADE_NOTICE_ICON,
      expireAt,
      maxDurationMs: MAX_ACTION_NOTICE_DURATION_MS,
    },
    {
      onAction: async () => {
        const result = await grabQuickMatchAndEnterAudition(payload.requestNo);
        if (result.status === "failed") showToast(result.message);
      },
    },
  );
}

/**
 * ACTIVITY_ROOM_NOTICE：活动发布成功 / 扩大匹配范围等 Toast。
 * 仅展示后端下发的 content 文案；不进房、不消费 roomId/roomVersion。
 */
export function handleActivityRoomNotice(command: RongCommand) {
  if (command.name !== ACTIVITY_ROOM_NOTICE) return;
  if (command.senderId !== PLATFORM_NOTICE_USER_ID) return;

  const content = String(command.data.content ?? "").trim();
  if (!content) return;

  showToast(content, { duration: ACTIVITY_ROOM_NOTICE_TOAST_MS });
}

export function handleOrderNotifyPopup(command: RongCommand, now = Date.now()) {
  if (command.name !== ORDER_NOTIFY) return;
  if (command.senderId !== PLATFORM_NOTICE_USER_ID) return;

  const payload = parseOrderNotifyPopup(command.data);
  if (!payload) return;

  // 催单无业务过期字段，按 sentTime 门控离线重放（长时间未登录后重连会整批重放旧消息）
  const stale =
    command.sentTime != null &&
    now - command.sentTime > COMMAND_STALE_MAX_MS;
  if (stale) {
    logger.warn("order_notify.stale_dropped", {
      orderNo: payload.orderNo,
      sentTime: formatServerDateTime(command.sentTime ?? now),
      skewMs: now - (command.sentTime ?? now),
    });
    return;
  }

  if (orderPayKeys.has(payload.orderNo)) return;

  const noticeId = `pay:${payload.orderNo}`;
  orderPayKeys.add(payload.orderNo);
  actionNotice.push(
    {
      id: noticeId,
      text: buildOrderPayMessage(payload.buyerNickname),
      actionText: "接单",
      icon: TRADE_NOTICE_ICON,
      expireAt: now + MAX_ACTION_NOTICE_DURATION_MS,
      maxDurationMs: MAX_ACTION_NOTICE_DURATION_MS,
    },
    {
      onAction: async () => {
        const { accessToken } = useAuthStore.getState();
        if (!accessToken) {
          showToast("请先登录");
          return;
        }
        try {
          await acceptOrder(payload.orderId, accessToken);
          actionNotice.dismiss(noticeId);
          showToast("接单成功");
          router.push({
            pathname: "/order/[id]",
            params: { id: payload.orderId, scope: "accept" },
          });
        } catch (error) {
          showToast(
            error instanceof Error && error.message
              ? error.message
              : "接单失败，请稍后重试",
          );
        }
      },
      onDisappear: () => releaseOrderPayKey(payload.orderNo),
    },
  );
}

/** 支付催单条消失（到期/接单成功/挤出）时释放去重键 */
export function releaseOrderPayKey(orderNo: string) {
  orderPayKeys.delete(orderNo);
}

/** 清空去重键（登出/切账号；测试也可调用） */
export function resetActionCommandDedupKeys() {
  quickMatchNoticeKeys.clear();
  orderPayKeys.clear();
}

/** 登出/切账号：清空抢单与催单去重 + 残留通知条（对齐 PC resetAccountState） */
export function clearActionCommandAccountState() {
  resetActionCommandDedupKeys();
  actionNotice.clear();
}
