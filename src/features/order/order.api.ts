import { apiClient } from "@/core/network/api-client";
import type { OrderFilter, OrderItemModel, OrderQueryStatus } from "./order.types";
import { readOrderTimeFields } from "./order-time-fields";

type ApiEnvelope<T> = { code?: string; info?: string; data?: T };
type ApiPage<T> = { records?: T[]; list?: T[]; page?: number; totalPages?: number; total?: number } | T[];
type ApiOrder = Record<string, unknown>;

const sellerAvatar = require("../../../assets/order/order-seller-avatar.svg");

const statusByFilter: Partial<Record<OrderFilter, OrderQueryStatus>> = {
  inProgress: "PROCESSING",
  completed: "FINISHED",
  cancelled: "CANCELED",
};

function stringValue(item: ApiOrder, ...keys: string[]) {
  const value = keys.map((key) => item[key]).find((candidate) => candidate !== undefined && candidate !== null && candidate !== "");
  return value === undefined ? undefined : String(value);
}

function numberValue(item: ApiOrder, ...keys: string[]) {
  const value = keys.map((key) => item[key]).find((candidate) => candidate !== undefined && candidate !== null);
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function recordsFrom(data: ApiPage<ApiOrder> | undefined) {
  if (Array.isArray(data)) return data;
  return data?.records ?? data?.list ?? [];
}

export function mapOrder(item: ApiOrder, index = 0): OrderItemModel {
  const rawStatus = stringValue(item, "orderStatus", "status", "orderQryStatus")?.toUpperCase();
  const status: OrderItemModel["status"] = rawStatus === "PENDING_PAY" ? "pendingPayment"
    : rawStatus === "PAID" ? "paid"
    : rawStatus === "ACCEPTED" ? "waitingService"
    : rawStatus === "IN_SERVICE" ? "inService"
    : rawStatus === "COMPLETED" || rawStatus === "SETTLED" || rawStatus === "FINISHED" ? "completed"
    : rawStatus === "REFUNDED" ? "refunded"
    : rawStatus === "CANCELED" || rawStatus === "CANCELLED" ? "cancelled"
    : rawStatus === "PROCESSING" ? "paid"
    : "pendingPayment";
  const id = stringValue(item, "id", "orderId", "orderNo") ?? `order-${index}`;
  const total = stringValue(item, "realPayAmount", "totalPrice", "payAmount", "amount") ?? "0";
  const statusLabel = {
    pendingPayment: "待支付", paid: "已支付", waitingService: "待服务",
    inService: "服务中", completed: "已完成", cancelled: "已取消", refunded: "已退款",
  }[status];
  const actions: OrderItemModel["actions"] = status === "pendingPayment"
    ? [{ key: "cancel", label: "取消订单", variant: "secondary" }, { key: "pay", label: "去支付", variant: "primary" }]
    : status === "paid" || status === "waitingService"
    ? [{ key: "cancel", label: "取消订单", variant: "secondary" }]
    : status === "inService"
    ? [{ key: "complete", label: "完成订单", variant: "primary" }]
    : status === "completed"
    ? [{ key: "afterSales", label: "售后", variant: "secondary" }, { key: "review", label: "评价", variant: "secondary" }, { key: "reorder", label: "再来一单", variant: "secondary" }]
    : [];
  return {
    id,
    orderNo: stringValue(item, "orderNo", "orderNumber") ?? id,
    status,
    statusLabel,
    sellerName: stringValue(item, "sellerName", "receiverNickname", "companionName", "clubName") ?? "盼之电竞俱乐部",
    sellerAvatar: stringValue(item, "sellerAvatar", "receiverHeadImage", "clubLogo", "logoUrl", "headImage") ?? sellerAvatar,
    serviceName: stringValue(item, "serviceName", "productName") ?? ([stringValue(item, "gameModeName"), stringValue(item, "gameLevelName")].filter(Boolean).join("-") || "陪玩服务"),
    gameName: stringValue(item, "gameName") ?? "未知游戏",
    unitPrice: stringValue(item, "unitPrice", "price") ?? total,
    quantity: numberValue(item, "quantity", "count", "num") ?? 1,
    totalPrice: total,
    ...readOrderTimeFields(item),
    actions,
  };
}

export async function cancelOrder(orderId: string, token: string): Promise<void> {
  const response = await apiClient<ApiEnvelope<unknown>>("/client/v1/order/cancel", {
    method: "POST",
    token,
    body: { action: { orderId: Number(orderId), reason: "用户取消订单" } },
  });
  if (response.code !== "SUCCESS") throw new Error(response.info || "取消订单失败");
}

export async function fetchOrderDetail(orderId: string, token: string): Promise<ApiOrder> {
  const response = await apiClient<ApiEnvelope<ApiOrder>>(`/client/v1/order/getDetail?orderId=${encodeURIComponent(orderId)}`, {
    method: "GET",
    token,
    // The detail endpoint expects orderId as a query parameter.
    headers: { "Content-Type": "application/json" },
  });
  if (response.code !== "SUCCESS" || !response.data) throw new Error(response.info || "订单详情加载失败");
  const nested = response.data.orderInfo;
  return nested && typeof nested === "object" ? { ...response.data, ...(nested as ApiOrder) } : response.data;
}

export async function fetchOrderPage(filter: OrderFilter, token: string, buyerUserId: string, page = 1, pageSize = 10) {
  const orderQryStatus = statusByFilter[filter];
  const response = await apiClient<ApiEnvelope<ApiPage<ApiOrder>>>("/client/v1/order/getPageList", {
    method: "POST",
    token,
    body: { page, pageSize, action: { buyerUserId: Number(buyerUserId), ...(orderQryStatus ? { orderQryStatus } : {}) } },
  });
  if (response.code !== "SUCCESS" || response.data === undefined) throw new Error(response.info || "订单加载失败");
  const data = response.data;
  return { items: recordsFrom(data).map(mapOrder), hasMore: !Array.isArray(data) && (data.page ?? page) < (data.totalPages ?? page) };
}
