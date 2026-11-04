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

/** 对齐 PC ChargeRecord / ClientWalletTransactionVO（充值与充值退款流水） */
export type ChargeRecord = {
  id: number;
  amount?: number | string;
  balanceAfter?: number | string;
  relatedOrderNo?: string;
  remark?: string;
  createTime?: string;
};

export type ChargeRecordsPage = {
  page?: number;
  pages?: number;
  total?: number;
  totalPages?: number;
  records?: ChargeRecord[];
};

const CHARGE_RECORDS_PAGE_SIZE = 20;

export async function fetchChargeRecords(
  token: string,
  page = 1,
  pageSize = CHARGE_RECORDS_PAGE_SIZE,
  signal?: AbortSignal,
): Promise<ChargeRecordsPage> {
  const response = await apiClient<ApiEnvelope<ChargeRecordsPage>>(
    "/client/v1/pay/chargeRecords",
    {
      method: "POST",
      token,
      signal,
      body: { page, pageSize, action: {} },
    },
  );
  return requireSuccess(response, "钻石明细加载失败");
}

export function chargeRecordsNextPage(
  page: ChargeRecordsPage,
  currentPage: number,
): number | undefined {
  const count = page.records?.length ?? 0;
  if (count === 0) return undefined;
  const totalPages = page.pages ?? page.totalPages;
  if (typeof totalPages === "number" && Number.isFinite(totalPages)) {
    return currentPage < totalPages ? currentPage + 1 : undefined;
  }
  if (page.total != null) {
    return currentPage * CHARGE_RECORDS_PAGE_SIZE < Number(page.total)
      ? currentPage + 1
      : undefined;
  }
  return count === CHARGE_RECORDS_PAGE_SIZE ? currentPage + 1 : undefined;
}

export { CHARGE_RECORDS_PAGE_SIZE };
