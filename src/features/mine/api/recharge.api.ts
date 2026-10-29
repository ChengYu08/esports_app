import { apiClient } from "@/core/network/api-client";

type ApiEnvelope<T> = { code?: string; info?: string; data?: T };

export type RechargePlan = {
  moneyAmount?: number | string;
  starAmount?: number | string;
};

export type RechargeChannel = {
  key?: string;
  label?: string;
  payChannel?: string;
  payWay?: string;
  payTypeEnum?: string;
};

export type RechargeConfig = {
  rechargeRatio?: number | string;
  rechargeMaxAmount?: number | string;
  channels?: RechargeChannel[];
  plans?: RechargePlan[];
  allowCustom?: boolean;
};

export type RechargePlatform = "ANDROID" | "IOS";

function requireSuccess<T>(response: ApiEnvelope<T>, fallback: string): T {
  if (response.code !== "SUCCESS" || response.data === undefined) {
    throw new Error(response.info || fallback);
  }
  return response.data;
}

export async function fetchRechargeConfig(
  token: string,
  platform: RechargePlatform = "ANDROID",
): Promise<RechargeConfig> {
  const response = await apiClient<ApiEnvelope<RechargeConfig>>(
    `/client/v1/pay/rechargeConfig?platform=${encodeURIComponent(platform)}`,
    { method: "GET", token },
  );
  return requireSuccess(response, "充值配置查询失败");
}

export type CreateAppPayOrderAction = {
  payChannel?: string;
  payWay?: string;
  moneyAmount: number;
  starAmount: number;
};

export type CreateAppPayOrderResult = {
  rechargeNo?: string;
  orderStr?: string;
  platformTxno?: string;
};

export async function createAppPayOrder(
  token: string,
  action: CreateAppPayOrderAction,
): Promise<CreateAppPayOrderResult> {
  const response = await apiClient<ApiEnvelope<CreateAppPayOrderResult>>(
    "/client/v1/pay/createAppPayOrder",
    { method: "POST", token, body: action },
  );
  return requireSuccess(response, "创建支付订单失败，请稍后再试");
}

export type CreatePayOrderAction = {
  payChannel?: string;
  payWay?: string;
  payTypeEnum?: string;
  moneyAmount: number;
  starAmount: number;
};

export type CreatePayOrderResult = {
  rechargeNo?: string;
  qrCode?: string;
  platformTxno?: string;
};

export async function createPayOrder(
  token: string,
  action: CreatePayOrderAction,
): Promise<CreatePayOrderResult> {
  const response = await apiClient<ApiEnvelope<CreatePayOrderResult>>(
    "/client/v1/pay/createPayOrder",
    { method: "POST", token, body: action },
  );
  return requireSuccess(response, "创建支付订单失败，请稍后再试");
}
