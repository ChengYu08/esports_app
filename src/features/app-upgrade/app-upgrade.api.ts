import { apiClient, type RequestOptions } from "@/core/network/api-client";

import {
  createAppUpgradeContract,
  type AppUpgradeRequestOptions,
  type AppUpgradeRequester,
  type ClientApiResponse,
} from "./app-upgrade.contract";

const request: AppUpgradeRequester = <T>(
  path: string,
  options?: AppUpgradeRequestOptions,
) => {
  const query = options?.query
    ? `?${new URLSearchParams(options.query).toString()}`
    : "";
  return apiClient<ClientApiResponse<T>>(path + query, {
    method: options?.method ?? "GET",
    timeoutMs: options?.timeoutMs,
  } as RequestOptions);
};

export const createAppUpgradeApi = (requester: AppUpgradeRequester = request) =>
  createAppUpgradeContract(requester);
export const appUpgradeApi = createAppUpgradeApi();
