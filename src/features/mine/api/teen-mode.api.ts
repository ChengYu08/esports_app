import { apiClient } from "@/core/network/api-client";

import {
  createTeenModeApi,
  type TeenModeStatus,
  type TeenRequester,
  type TeenResponse,
} from "./teen-mode.contract";

function createDefaultTeenRequester(): TeenRequester {
  return async (path, options) => {
    const response = await apiClient<TeenResponse<never>>(path, {
      method: "POST",
      token: options.token,
      body: options.body,
    });
    return response as TeenResponse<never>;
  };
}

/** 默认实例：走全局 apiClient（token 请求头 + JSON）。 */
export const teenModeApi = createTeenModeApi(createDefaultTeenRequester());
