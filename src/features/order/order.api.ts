import { apiClient } from "@/core/network/api-client";
import type { OrderFilter, OrderItemModel, OrderQueryStatus, OrderScope } from "./order.types";
import { readOrderTimeFields } from "./order-time-fields";

type ApiEnvelope<T> = { code?: string; info?: string; data?: T };
type ApiPage<T> = { records?: T[]; list?: T[]; page?: number; pages?: number; totalPages?: number; total?: number } | T[];
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

export function mapOrder(
  item: ApiOrder,
  index = 0,
  scope: OrderScope = "place",
): OrderItemModel {
  const gameIcon = stringValue(item, "gameIconUrl");
  const receiverAvatar = stringValue(item, "receiverHeadImage", "companionHeadImage");
  const rawStatus = stringValue(item, "orderStatus", "status", "orderQryStatus")?.toUpperCase();
  const status: OrderItemModel["status"] = rawStatus === "PENDING_PAY" ? "pendingPayment"
    : rawStatus === "PAID" ? "paid"
    : rawStatus === "ACCEPTED" ? "waitingService"
    : rawStatus === "IN_SERVICE" ? "inService"
    : rawStatus === "COMPLETED" || rawStatus === "SETTLED" || rawStatus === "FINISHED" ? "completed"
    : rawStatus === "PARTIAL_REFUNDED" ? "partiallyRefunded"
    : rawStatus === "REFUNDED" ? "refunded"
    : rawStatus === "CANCELED" || rawStatus === "CANCELLED" ? "cancelled"
    : rawStatus === "PROCESSING" ? "paid"
    : "pendingPayment";
  const id = stringValue(item, "id", "orderId", "orderNo") ?? `order-${index}`;
  const total = stringValue(item, "realPayAmount", "totalPrice", "payAmount", "amount") ?? "0";
  // 接口分别返回模式、等级和服务，不能只取服务名或用旧标题覆盖。
  const serviceParts = ["gameModeName", "gameLevelName", "serviceName"]
    .map((key) => stringValue(item, key)?.trim())
    .filter(Boolean);
  // 免单与普通退款区分展示，部分退款不能回落成待支付。
  const isFreeOrder = item.isFreeOrder === true;
  const statusLabel = isFreeOrder && status === "refunded"
    ? "已免单"
    : isFreeOrder && status === "partiallyRefunded"
    ? "部分免单"
    : scope === "accept" && status === "paid"
    ? "用户已支付"
    : {
        pendingPayment: "待支付", paid: "已支付", waitingService: "待服务",
        inService: "服务中", completed: "已完成", partiallyRefunded: "部分退款", cancelled: "已取消", refunded: "已退款",
      }[status];
  const reviewId = numberValue(item, "reviewId", "orderReviewId");
  const reviewExists = item.reviewExists === true || reviewId !== undefined;
  const placeActions: OrderItemModel["actions"] = status === "pendingPayment"
    ? [{ key: "cancel", label: "取消订单", variant: "secondary" }, { key: "pay", label: "去支付", variant: "primary" }]
    : status === "paid" || status === "waitingService"
    ? [{ key: "cancel", label: "取消订单", variant: "secondary" }]
    : status === "inService"
    ? [{ key: "complete", label: "完成订单", variant: "primary" }]
    : status === "completed" || status === "partiallyRefunded"
    ? [{ key: "afterSales", label: "售后", variant: "secondary" }, { key: "review", label: reviewExists ? "已评价" : "评价", variant: "secondary" }, { key: "reorder", label: "再来一单", variant: "secondary" }]
    : [];
  const times = readOrderTimeFields(item);
  const serviceEnd = times.serviceEndTime ? Date.parse(times.serviceEndTime) : NaN;
  const serviceStart = times.serviceStartTime ? Date.parse(times.serviceStartTime) : NaN;
  const serviceEnded = Number.isFinite(serviceEnd)
    ? Date.now() >= serviceEnd
    : Number.isFinite(serviceStart) && Date.now() >= serviceStart + Math.max(1, numberValue(item, "quantity", "count", "num") ?? 1) * 3_600_000;
  const settled = item.isSettle === true;
  // 对齐 Web acceptActions：已结账不再免单；未结账的已完成订单仍可免单。
  const acceptActions: OrderItemModel["actions"] = settled
    ? status === "inService" && serviceEnded ? [{ key: "complete", label: "完成服务", variant: "primary" }] : []
    : status === "paid"
    ? [{ key: "reject", label: "拒绝", variant: "secondary" }, { key: "accept", label: "同意接单", variant: "primary" }]
    : status === "waitingService"
      ? [{ key: "start", label: "开始订单", variant: "primary" }]
      : status === "inService"
        ? serviceEnded
          ? [{ key: "free", label: "免单", variant: "secondary" }, { key: "complete", label: "完成服务", variant: "primary" }]
          : [{ key: "free", label: "免单", variant: "secondary" }]
        : status === "completed"
          ? [{ key: "free", label: "免单", variant: "secondary" }]
          : [];
  return {
    id,
    orderNo: stringValue(item, "orderNo", "orderNumber") ?? id,
    status,
    statusLabel,
    buyerUserId: stringValue(item, "buyerUserId"),
    receiverUserId: stringValue(item, "receiverUserId"),
    receiverName: stringValue(item, "receiverNickname", "companionName"),
    receiverAvatar: receiverAvatar ? { uri: receiverAvatar } : undefined,
    clubId: numberValue(item, "companionClubId", "clubId", "receiverClubId"),
    // 俱乐部名仅在下单侧展示（接单侧对端是老板，无俱乐部概念）
    clubName: scope === "accept"
      ? undefined
      : stringValue(item, "companionClubName", "clubName"),
    reviewId,
    reviewExists,
    sellerName: scope === "accept"
      ? stringValue(item, "buyerNickname") ?? "老板"
      : stringValue(item, "sellerName", "receiverNickname", "companionName", "clubName") ?? "盼之电竞俱乐部",
    sellerAvatar: scope === "accept"
      ? stringValue(item, "buyerHeadImage") ?? sellerAvatar
      : stringValue(item, "sellerAvatar", "receiverHeadImage", "clubLogo", "logoUrl", "headImage") ?? sellerAvatar,
    serviceName: serviceParts.join("-") || stringValue(item, "title", "productName") || "陪玩服务",
    gameName: stringValue(item, "gameName") ?? "未知游戏",
    gameIcon: gameIcon ? { uri: gameIcon } : undefined,
    unitPrice: stringValue(item, "unitPrice", "price") ?? total,
    quantity: numberValue(item, "quantity", "count", "num") ?? 1,
    billingUnitName: stringValue(item, "billingUnitName") ?? "小时",
    totalPrice: total,
    freeAmount: isFreeOrder ? stringValue(item, "refundAmount") : undefined,
    remark: stringValue(item, "remark", "buyerRemark"),
    ...times,
    dispatchTime: stringValue(item, "dispatchTime", "assignedTime", "acceptedTime"),
    dispatchDeadline: stringValue(item, "stopGrabTime", "grabEndTime", "quickMatchEndTime", "quickMatchExpireTime", "dispatchExpireTime", "expireTime"),
    sourceLabel: scope === "dispatch"
      ? stringValue(item, "publishType") === "RECEPTION" ? "客服派单" : "用户派单"
      : undefined,
    actions: scope === "accept" ? acceptActions : placeActions,
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

export async function completeOrder(orderId: string | number, token: string): Promise<void> {
  const response = await apiClient<ApiEnvelope<unknown>>("/client/v1/order/completeService", {
    method: "POST", token, body: { action: { orderId: Number(orderId) } },
  });
  if (response.code !== "SUCCESS") throw new Error(response.info || "完成订单失败");
}

async function postOrderAction(path: string, orderId: string | number, token: string): Promise<void> {
  const response = await apiClient<ApiEnvelope<unknown>>(path, {
    method: "POST", token, body: { action: { orderId: Number(orderId) } },
  });
  if (response.code !== "SUCCESS") throw new Error(response.info || "订单操作失败");
}

export function acceptOrder(orderId: string | number, token: string) {
  return postOrderAction("/client/v1/order/accept", orderId, token);
}

export function rejectOrder(orderId: string | number, token: string) {
  return postOrderAction("/client/v1/order/reject", orderId, token);
}

export function startOrderService(orderId: string | number, token: string) {
  return postOrderAction("/client/v1/order/startService", orderId, token);
}

export async function freeOrderService(orderId: string | number, freeAmount: number, token: string) {
  const response = await apiClient<ApiEnvelope<unknown>>("/client/v1/order/free", {
    method: "POST", token,
    body: { action: { orderId: Number(orderId), freeAmount, actionType: "COMPANION_FREE", reason: "陪玩服务免单" } },
  });
  if (response.code !== "SUCCESS") throw new Error(response.info || "免单失败");
}

export type AfterSaleMember = { userId: number; nickname?: string; headImage?: string; onlineStatus?: number | null };

export async function fetchAfterSaleMembers(clubId: number, token: string): Promise<AfterSaleMember[]> {
  const response = await apiClient<ApiEnvelope<AfterSaleMember[]>>(`/client/v1/afterSale/memberList?clubId=${encodeURIComponent(clubId)}`, { method: "GET", token });
  if (response.code !== "SUCCESS") throw new Error(response.info || "售后客服加载失败");
  return Array.isArray(response.data) ? response.data : [];
}

export type OrderReview = { id?: number; rating: number; content?: string; imageUrls?: string[] };
export async function submitOrderReview(orderNo: string, rating: number, content: string, token: string): Promise<void> {
  const response = await apiClient<ApiEnvelope<unknown>>("/client/v1/afterSale/evaluate", { method: "POST", token, body: { action: { orderNo, rating, content } } });
  if (response.code !== "SUCCESS") throw new Error(response.info || "评价提交失败");
}
export async function fetchOrderReview(reviewId: number, token: string): Promise<OrderReview> {
  const response = await apiClient<ApiEnvelope<OrderReview>>(`/client/v1/afterSale/review/detail?reviewId=${reviewId}`, { method: "GET", token });
  if (response.code !== "SUCCESS" || !response.data) throw new Error(response.info || "评价加载失败");
  return response.data;
}

export async function fetchOrderDetail(orderId: string, token: string, signal?: AbortSignal): Promise<ApiOrder> {
  const response = await apiClient<ApiEnvelope<ApiOrder>>(`/client/v1/order/getDetail?orderId=${encodeURIComponent(orderId)}`, {
    method: "GET",
    token,
    signal,
    // The detail endpoint expects orderId as a query parameter.
    headers: { "Content-Type": "application/json" },
  });
  if (response.code !== "SUCCESS" || !response.data) throw new Error(response.info || "订单详情加载失败");
  const nested = response.data.orderInfo;
  return nested && typeof nested === "object" ? { ...response.data, ...(nested as ApiOrder) } : response.data;
}

export async function fetchOrderPage(filter: OrderFilter, token: string, userId: string, scope: OrderScope = "place", page = 1, pageSize = 20, signal?: AbortSignal) {
  const orderQryStatus = statusByFilter[filter];
  const userKey = scope === "accept" ? "receiverUserId" : "buyerUserId";
  const response = await apiClient<ApiEnvelope<ApiPage<ApiOrder>>>("/client/v1/order/getPageList", {
    method: "POST",
    token,
    body: { page, pageSize, action: { [userKey]: Number(userId), ...(orderQryStatus ? { orderQryStatus } : {}) } },
    signal,
  });
  if (response.code !== "SUCCESS" || response.data === undefined) throw new Error(response.info || "订单加载失败");
  const data = response.data;
  const records = recordsFrom(data);
  const total = Array.isArray(data) ? undefined : data.total;
  const totalPages = Array.isArray(data) ? undefined : data.totalPages ?? data.pages;
  const hasMore = totalPages !== undefined
    ? (Array.isArray(data) ? page : data.page ?? page) < totalPages
    : total !== undefined
      ? page * pageSize < total
      : records.length >= pageSize;
  return { items: records.map((item, index) => mapOrder(item, index, scope)), hasMore };
}
