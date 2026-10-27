import { useAuthStore } from "@esports/auth";
import { router } from "expo-router";
import Toast from "react-native-root-toast";

import type { RongCommand } from "@/features/message/rongcloud-command";
import {
  parseOrderNotifyPopup,
  parseQuickMatchExpired,
  parseQuickMatchNotice,
  PLATFORM_NOTICE_USER_ID,
} from "@/features/message/rongcloud-commands";
import { grabQuickMatchAndEnterAudition } from "@/features/match/grab-quick-match-flow";
import { acceptOrder } from "@/features/order/order.api";
import { actionNotice } from "@/shared/ui/action-notice/action-notice-store";
import { TRADE_NOTICE_ICON } from "@/shared/ui/action-notice/trade-notice-icon";

const QUICK_MATCH_NOTICE = "QUICK_MATCH_NOTICE";
const QUICK_MATCH_EXPIRED = "QUICK_MATCH_EXPIRED";
const QUICK_MATCH_CANCELLED = "QUICK_MATCH_CANCELLED";
const ORDER_NOTIFY = "ORDER_NOTIFY";
const MAX_ACTION_NOTICE_DURATION_MS = 15_000;

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

/** 抢单通知去重：requestNo（条消失时释放，允许同需求极端重推再提示） */
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

function buildOrderPayMessage(buyerNickname: string) {
  return `「${buyerNickname || "老板"}」已支付订单，请尽快接单`;
}

export function handleQuickMatchNotice(command: RongCommand, now = Date.now()) {
  if (command.name !== QUICK_MATCH_NOTICE) return;
  if (command.senderId !== PLATFORM_NOTICE_USER_ID) return;

  const payload = parseQuickMatchNotice(command.data);
  if (!payload) return;
  if (quickMatchNoticeKeys.has(payload.requestNo)) return;

  const expireAt = Number.isFinite(payload.expireAtMs)
    ? payload.expireAtMs
    : now + MAX_ACTION_NOTICE_DURATION_MS;
  if (expireAt - now <= 0) return;

  const noticeId = `qm:${payload.requestNo}`;
  quickMatchNoticeKeys.add(payload.requestNo);
  actionNotice.push(
    {
      id: noticeId,
      text: buildQuickMatchMessage(payload),
      actionText: "去抢单",
      icon: TRADE_NOTICE_ICON,
      expireAt,
      maxDurationMs: MAX_ACTION_NOTICE_DURATION_MS,
    },
    {
      onAction: async () => {
        const result = await grabQuickMatchAndEnterAudition(payload.requestNo);
        if (result.status === "failed") {
          Toast.show(result.message, { duration: Toast.durations.SHORT });
          return;
        }
        actionNotice.dismiss(noticeId);
      },
      onDisappear: () => releaseQuickMatchNoticeKey(payload.requestNo),
    },
  );
}

export function handleOrderNotifyPopup(command: RongCommand, now = Date.now()) {
  if (command.name !== ORDER_NOTIFY) return;
  if (command.senderId !== PLATFORM_NOTICE_USER_ID) return;

  const payload = parseOrderNotifyPopup(command.data);
  if (!payload) return;
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
          Toast.show("请先登录", { duration: Toast.durations.SHORT });
          return;
        }
        try {
          await acceptOrder(payload.orderId, accessToken);
          actionNotice.dismiss(noticeId);
          Toast.show("接单成功", { duration: Toast.durations.SHORT });
          router.push({ pathname: "/order/[id]", params: { id: payload.orderId } });
        } catch (error) {
          Toast.show(
            error instanceof Error && error.message ? error.message : "接单失败，请稍后重试",
            { duration: Toast.durations.SHORT },
          );
        }
      },
      onDisappear: () => releaseOrderPayKey(payload.orderNo),
    },
  );
}

/** 抢单条消失（到期/忽略/抢单成功）时释放去重键 */
export function releaseQuickMatchNoticeKey(requestNo: string) {
  quickMatchNoticeKeys.delete(requestNo);
}

/** 支付催单条消失（到期/接单成功/挤出）时释放去重键 */
export function releaseOrderPayKey(orderNo: string) {
  orderPayKeys.delete(orderNo);
}

/** 测试专用：清空去重键 */
export function resetActionCommandDedupKeys() {
  quickMatchNoticeKeys.clear();
  orderPayKeys.clear();
}
