import { apiClient } from "@/core/network/api-client";
import type { OrderItemModel } from "./order.types";

type ApiEnvelope<T> = { code?: string; info?: string; data?: T };
type ApiPage<T> = { records?: T[]; list?: T[]; total?: number };

export type DispatchRequest = {
  requestNo: string;
  publishType?: string;
  buyerUserId?: number | string;
  buyerNickname?: string;
  buyerHeadImage?: string;
  clubId?: number | string;
  clubName?: string;
  gameName?: string;
  gameIconUrl?: string;
  modeName?: string;
  levelName?: string;
  serviceName?: string;
  billingUnitName?: string;
  quantity?: number;
  needVoice?: boolean;
  genderRequirement?: number;
  maleUnitPrice?: number | string;
  femaleUnitPrice?: number | string;
  unitDurationMinutes?: number;
  remark?: string;
  status?: string;
  grabbed?: boolean;
  currentGrabStatus?: string;
  grabCount?: number;
  orderId?: number | string | null;
  selectedGrabId?: number | string | null;
  roomId?: number | string | null;
  roomVersion?: number | string | null;
  expireTime?: string;
  endTime?: string;
  createTime?: string;
};

type GrabHistory = {
  id: number | string;
  requestNo?: string;
  grabStatus?: "GRABBED" | "SUCCESS" | "FAILED";
  orderId?: number | string | null;
  request?: DispatchRequest | null;
};

function recordsFrom<T>(data?: ApiPage<T> | T[]) {
  return Array.isArray(data) ? data : data?.records ?? data?.list ?? [];
}

function mapDispatchRequest(request: DispatchRequest, userGender: number, historyStatus?: string, historyId?: string): OrderItemModel {
  const quantity = Math.max(1, Number(request.quantity) || 1);
  const unitPrice = Number(userGender === 1 ? request.maleUnitPrice : request.femaleUnitPrice) || 0;
  const grabStatus = historyStatus ?? request.currentGrabStatus;
  const requestStatus = request.status ?? "MATCHING";
  const serviceParts = [request.modeName, request.levelName, request.serviceName]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean);
  const requestNo = request.requestNo;
  const canGrab = !historyStatus && requestStatus === "MATCHING" && !request.grabbed && !grabStatus;

  return {
    id: historyId ?? `dispatch-${requestNo}`,
    orderNo: requestNo,
    requestNo,
    status: requestStatus === "ORDERED" ? "paid" : "waitingService",
    statusLabel: historyStatus === "SUCCESS" ? "抢单成功"
      : historyStatus === "FAILED" ? "抢单失败"
        : historyStatus === "GRABBED" ? "已抢单"
          : request.publishType === "RECEPTION" ? "客服派单" : "用户派单",
    sellerName: request.buyerNickname || "老板",
    sellerAvatar: request.buyerHeadImage ? { uri: request.buyerHeadImage } : require("../../../assets/order/order-seller-avatar.svg"),
    gameIcon: request.gameIconUrl ? { uri: request.gameIconUrl } : undefined,
    serviceName: serviceParts.join("-") || "陪玩服务",
    gameName: request.gameName || "未知游戏",
    billingUnitName: request.billingUnitName || "小时",
    unitPrice: String(unitPrice),
    quantity,
    totalPrice: String(unitPrice * quantity),
    remark: request.remark,
    sourceLabel: historyStatus ? undefined : request.publishType === "RECEPTION" ? "客服派单" : "用户派单",
    voiceTag: request.needVoice ? "需试音" : "不试音",
    actions: canGrab ? [{ key: "grab", label: "抢单", variant: "primary" }] : [],
  };
}

async function fetchDispatchRecords<T>(path: string, token: string, page: number, pageSize: number, action: Record<string, unknown>, signal?: AbortSignal) {
  const response = await apiClient<ApiEnvelope<ApiPage<T> | T[]>>(path, {
    method: "POST", token, body: { page, pageSize, action }, signal,
  });
  if (response.code !== "SUCCESS" || response.data === undefined) throw new Error(response.info || "派单信息加载失败");
  return { records: recordsFrom(response.data), total: Array.isArray(response.data) ? response.data.length : Number(response.data.total) || 0 };
}

export async function fetchDispatchPage(
  filter: "grabbing" | "history",
  token: string,
  userGender: number,
  page = 1,
  pageSize = 10,
  signal?: AbortSignal,
) {
  if (filter === "grabbing") {
    const result = await fetchDispatchRecords<DispatchRequest>("/client/v1/quickMatch/available/page", token, page, pageSize, {}, signal);
    return {
      items: result.records.map((item) => mapDispatchRequest(item, userGender)),
      total: result.total,
      hasMore: result.records.length >= pageSize && page * pageSize < result.total,
    };
  }
  const result = await fetchDispatchRecords<GrabHistory>("/client/v1/quickMatch/grab/my/page", token, page, pageSize, {}, signal);
  return {
    items: result.records.map((item) => mapDispatchRequest(
      item.request ?? { requestNo: item.requestNo || String(item.id) },
      userGender,
      item.grabStatus,
      `history-${item.id}`,
    )),
    total: result.total,
    hasMore: result.records.length >= pageSize && page * pageSize < result.total,
  };
}

export async function fetchDispatchDetail(requestNo: string, token: string, signal?: AbortSignal): Promise<DispatchRequest> {
  const response = await apiClient<ApiEnvelope<DispatchRequest>>(
    `/client/v1/quickMatch/detail?requestNo=${encodeURIComponent(requestNo)}`,
    { method: "GET", token, signal },
  );
  if (response.code !== "SUCCESS" || !response.data) throw new Error(response.info || "派单详情加载失败");
  return response.data;
}

export async function grabDispatchRequest(requestNo: string, token: string) {
  const response = await apiClient<ApiEnvelope<unknown>>("/client/v1/quickMatch/grab", {
    method: "POST", token, body: { action: { requestNo } },
  });
  if (response.code !== "SUCCESS") throw new Error(response.info || "抢单失败");
}
