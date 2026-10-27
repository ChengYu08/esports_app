import { apiClient, type RequestOptions } from "@/core/network/api-client";

import {
  createOtaConfigContract,
  type ClientApiResponse,
  type OtaConfigRequestOptions,
  type OtaConfigRequester,
} from "./ota-config.contract";

/** 通用配置中心 key：RN 热更门禁配置 */
export const OTA_CONFIG_KEY = "pzdj_app_rn_update_config";

const request: OtaConfigRequester = <T>(
  path: string,
  options?: OtaConfigRequestOptions,
) => {
  const query = options?.query
    ? `?${new URLSearchParams(options.query).toString()}`
    : "";
  return apiClient<ClientApiResponse<T>>(path + query, {
    method: options?.method ?? "GET",
    timeoutMs: options?.timeoutMs,
  } as RequestOptions);
};

export const createOtaConfigApi = (requester: OtaConfigRequester = request) =>
  createOtaConfigContract(requester);
export const otaConfigApi = createOtaConfigApi();
