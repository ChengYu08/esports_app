import { parseServerDateTime } from "@/shared/time/server-date";
import type { OrderItemModel } from "./order.types";

// 对齐后端 OrderProperties.timOutNoPay 默认值；接口有截止时间时以接口为准。
const DEFAULT_PAYMENT_TIMEOUT_MS = 5 * 60 * 1000;

export function getPaymentDeadline(
  order: Pick<OrderItemModel, "status" | "createTime" | "payDeadline">,
): number | null {
  if (order.status !== "pendingPayment") {
    return null;
  }
  const deadline = parseServerDateTime(order.payDeadline);
  if (Number.isFinite(deadline)) {
    return deadline;
  }
  const createdAt = parseServerDateTime(order.createTime);
  return Number.isFinite(createdAt) ? createdAt + DEFAULT_PAYMENT_TIMEOUT_MS : null;
}

export function formatPaymentCountdown(deadline: number, now: number): string {
  const seconds = Math.max(0, Math.ceil((deadline - now) / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
