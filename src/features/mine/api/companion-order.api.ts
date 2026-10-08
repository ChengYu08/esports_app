import { apiClient } from "@/core/network/api-client";
import { buildCreateOrderAction } from "./companion-order.payload";
import type { CompanionOrderContext, CompanionServiceOption } from "./companion-order.types";

export { buildCreateOrderAction } from "./companion-order.payload";
export type { CompanionOrderContext, CompanionServiceOption } from "./companion-order.types";

type ApiEnvelope<T> = { code?: string; info?: string; data?: T };

export type CreatedOrder = {
  orderId: number;
  orderNo?: string;
  totalPrice?: number | string;
};

type ApiService = {
  companionServiceId?: number;
  clubGameServiceName?: string;
  price?: number | string;
  status?: number;
};

function requireSuccess<T>(response: ApiEnvelope<T>, fallback: string): T {
  if (response.code !== "SUCCESS" || response.data === undefined) {
    throw new Error(response.info || fallback);
  }
  return response.data;
}

function requireVoidSuccess(response: ApiEnvelope<unknown>, fallback: string) {
  if (response.code !== "SUCCESS") {
    throw new Error(response.info || fallback);
  }
}

export async function fetchCompanionServices(
  context: Pick<CompanionOrderContext, "clubId" | "serviceUserId" | "gameLevelId">,
  token: string,
): Promise<CompanionServiceOption[]> {
  const response = await apiClient<ApiEnvelope<ApiService[]>>(
    "/client/v1/companion/public/companion/getCompanionGameServiceList",
    {
      method: "POST",
      token,
      body: {
        clubId: context.clubId,
        companionUserId: context.serviceUserId,
        gameLevelId: context.gameLevelId,
      },
    },
  );
  return requireSuccess(response, "服务列表加载失败")
    .filter((item) => item.status !== 0 && item.companionServiceId !== undefined)
    .map((item) => ({
      companionServiceId: item.companionServiceId as number,
      name: item.clubGameServiceName || `服务${item.companionServiceId}`,
      price: Number(item.price) || 0,
    }));
}

export async function createCompanionOrder(
  action: ReturnType<typeof buildCreateOrderAction>,
  token: string,
): Promise<CreatedOrder> {
  const response = await apiClient<ApiEnvelope<CreatedOrder>>("/client/v1/order/create", {
    method: "POST",
    token,
    body: { action },
  });
  return requireSuccess(response, "创建订单失败");
}

export async function fetchStarBalance(token: string): Promise<number> {
  const response = await apiClient<ApiEnvelope<{ starBalance?: number | string }>>(
    "/client/v1/pay/starBalance",
    { method: "POST", token, body: {} },
  );
  return Number(requireSuccess(response, "星钻余额查询失败").starBalance) || 0;
}

export async function payCompanionOrder(orderId: number, token: string): Promise<void> {
  const response = await apiClient<ApiEnvelope<unknown>>("/client/v1/order/pay", {
    method: "POST",
    token,
    body: { action: { orderId } },
  });
  requireVoidSuccess(response, "支付失败");
}
