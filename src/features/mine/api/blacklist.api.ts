import { apiClient, type RequestOptions } from "@/core/network/api-client";

type ApiEnvelope<T> = {
  code?: string;
  info?: string;
  data?: T;
};

/**
 * 无返回值请求：后端 `R<Void>` 成功时 data 为空，仅以 code 判定成功。
 */
async function requestVoid(
  path: string,
  options: RequestOptions,
): Promise<void> {
  const response = await apiClient<ApiEnvelope<unknown>>(path, options);
  if (response.code !== "SUCCESS") {
    throw new Error(response.info || "请求失败");
  }
}

/** 拉黑目标用户（POST /client/v1/userBlacklist/add）。 */
export async function addBlacklistedUser(
  blockedUserId: string,
  token: string,
): Promise<void> {
  await requestVoid("/client/v1/userBlacklist/add", {
    method: "POST",
    token,
    body: { blockedUserId },
  });
}

/** 解除对目标用户的拉黑（POST /client/v1/userBlacklist/remove）。 */
export async function removeBlacklistedUser(
  blockedUserId: string,
  token: string,
): Promise<void> {
  await requestVoid("/client/v1/userBlacklist/remove", {
    method: "POST",
    token,
    body: { blockedUserId },
  });
}

/** 查询是否已拉黑目标用户（POST /client/v1/userBlacklist/status），返回后端关系表真实状态。 */
export async function fetchBlacklistStatus(
  blockedUserId: string,
  token: string,
): Promise<boolean> {
  const response = await apiClient<ApiEnvelope<boolean>>(
    "/client/v1/userBlacklist/status",
    {
      method: "POST",
      token,
      body: { blockedUserId },
    },
  );
  if (response.code !== "SUCCESS") {
    throw new Error(response.info || "请求失败");
  }
  return response.data === true;
}
