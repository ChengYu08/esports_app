import { apiClient } from "@/core/network/api-client";

import {
  createTeenModeApi,
  type TeenModeConfig,
  type TeenRequester,
  type TeenResponse,
} from "./teen-mode.contract";

function createDefaultTeenRequester(): TeenRequester {
  return async (path, options) => {
    const response = await apiClient<TeenResponse<never>>(path, {
      method: options.method,
      token: options.token,
      ...(options.body !== undefined ? { body: options.body } : {}),
    });
    return response as TeenResponse<never>;
  };
}

/** 默认实例：走全局 apiClient（token 请求头 + JSON）。 */
export const teenModeApi = createTeenModeApi(createDefaultTeenRequester());

let cachedConfig: { token: string; config: TeenModeConfig } | null = null;

/**
 * 拉取锁定时段配置：同一 token 进程内缓存（配置仅 Nacos 手动变更，重启后自然刷新）。
 * 失败抛错，由调用方保持 fail-closed（配置未知时已开启账号继续锁定），客户端不设兜底时段。
 */
export async function fetchTeenModeConfig(
  token: string,
): Promise<TeenModeConfig> {
  if (cachedConfig?.token === token) {
    return cachedConfig.config;
  }
  const config = await teenModeApi.config(token);
  cachedConfig = { token, config };
  return config;
}
