import { useEffect } from "react";

import { logger } from "@/core/logging/logger";
import type { ManagedMessage } from "@/features/message/message-state";
import { subscribeRongMessageEvents } from "@/features/message/rongcloud-im";
import { refreshOrdersForRemoteChange } from "./order-query";

/** 从订单状态变更消息中取订单标识（id 与单号都返回，覆盖两种缓存 key）。 */
export function orderNotifyTargets(message: ManagedMessage): string[] {
  if (message.kind !== "orderNotify") return [];
  return [message.orderId, message.orderNo]
    .filter((value): value is string => Boolean(value));
}

/** 收到订单状态变更消息后刷新订单缓存（列表 + 当前打开的详情）。 */
export function handleOrderNotifyMessage(peerId: string, message: ManagedMessage) {
  const targets = orderNotifyTargets(message);
  if (targets.length === 0) return;
  logger.info("order_notify.received", { peerId, orderIds: targets.join(",") });
  void refreshOrdersForRemoteChange(targets);
}

/**
 * 陪玩侧的接单/开始/完成等状态变更通过融云 ORDER_NOTIFY 自定义消息
 * 推送到用户端；全局订阅它并实时刷新订单缓存，避免用户端详情页
 * 停留在旧状态（订单查询全局 staleTime 30s，且无窗口聚焦重拉机制）。
 */
export function OrderNotifySyncHost() {
  useEffect(() => {
    const stop = subscribeRongMessageEvents((peerId, message) => {
      handleOrderNotifyMessage(peerId, message);
    });
    return () => { stop(); };
  }, []);

  return null;
}
