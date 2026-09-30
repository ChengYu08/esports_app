import { apiClient } from "@/core/network/api-client";
import type { OrderFilter, OrderItemModel, OrderQueryStatus } from "./order.types";

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

function mapOrder(item: ApiOrder, index: number): OrderItemModel {
  const rawStatus = stringValue(item, "orderQryStatus", "status", "orderStatus");
  const status = rawStatus === "FINISHED" ? "completed" : rawStatus === "CANCELED" ? "cancelled" : rawStatus === "PROCESSING" ? "paid" : "pendingPayment";
  const id = stringValue(item, "id", "orderId", "orderNo") ?? `order-${index}`;
  const total = stringValue(item, "totalPrice", "payAmount", "amount") ?? "0";
  return {
    id,
    status,
    statusLabel: status === "completed" ? "已完成" : status === "cancelled" ? "已取消" : status === "paid" ? "进行中" : "待支付",
    sellerName: stringValue(item, "sellerName", "clubName", "companionName") ?? "盼之电竞俱乐部",
    sellerAvatar: stringValue(item, "sellerAvatar", "clubLogo", "logoUrl", "headImage") ?? sellerAvatar,
    serviceName: stringValue(item, "serviceName", "productName", "serviceMode") ?? "陪玩服务",
    gameName: stringValue(item, "gameName") ?? "未知游戏",
    unitPrice: stringValue(item, "unitPrice", "price") ?? total,
    quantity: numberValue(item, "quantity", "count", "num") ?? 1,
    totalPrice: total,
    actions: status === "pendingPayment" ? [{ key: "cancel", label: "取消订单", variant: "secondary" }, { key: "pay", label: "去支付", variant: "primary" }] : status === "completed" ? [{ key: "afterSales", label: "售后", variant: "secondary" }, { key: "review", label: "评价", variant: "secondary" }] : [{ key: "cancel", label: "取消订单", variant: "secondary" }],
  };
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
