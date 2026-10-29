import { apiClient } from "@/core/network/api-client";

type ApiEnvelope<T> = {
  code?: string;
  info?: string;
  data?: T;
};

export type IapProductVO = {
  productId: string;
  /** 数字字符串（服务端 Long 序列化为 string） */
  starAmount: string;
  productType: string;
};

export type PurchaseIntentVO = {
  intentNo: string;
  appAccountToken: string;
  productId: string;
  starAmount: string;
  expiresAt?: string;
};

export type IapTransactionResultStatus = "DELIVERED" | "PENDING" | "REJECTED";

export type IapTransactionResultVO = {
  transactionId?: string;
  status: IapTransactionResultStatus;
  starAmount?: string;
  message?: string;
};

function requireSuccess<T>(response: ApiEnvelope<T>, fallback: string): T {
  if (response.code !== "SUCCESS" || response.data === undefined) {
    throw new Error(response.info || fallback);
  }
  return response.data;
}

export async function fetchIapProducts(
  token: string,
  bundleId?: string,
): Promise<IapProductVO[]> {
  const query = bundleId ? `?bundleId=${encodeURIComponent(bundleId)}` : "";
  const response = await apiClient<ApiEnvelope<IapProductVO[]>>(
    `/client/v1/iap/products${query}`,
    { method: "POST", token },
  );
  return requireSuccess(response, "充值档位查询失败");
}

export async function createPurchaseIntent(
  payload: { productId: string; clientRequestId: string },
  token: string,
): Promise<PurchaseIntentVO> {
  const response = await apiClient<ApiEnvelope<PurchaseIntentVO>>(
    "/client/v1/iap/purchase-intents",
    { method: "POST", token, body: payload },
  );
  return requireSuccess(response, "创建购买意图失败");
}

export async function submitIapTransactions(
  jwsList: string[],
  token: string,
): Promise<IapTransactionResultVO[]> {
  const response = await apiClient<ApiEnvelope<IapTransactionResultVO[]>>(
    "/client/v1/iap/transactions",
    {
      method: "POST",
      token,
      body: { transactions: jwsList.map((jws) => ({ jws })) },
    },
  );
  return requireSuccess(response, "苹果交易上报失败");
}
