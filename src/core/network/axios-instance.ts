import { axiosCreate } from "./axios-create";

import { env } from "@/core/config/env";

/** 共享业务 API Axios 实例：JSON 传输与默认配置的唯一来源。 */
export const apiAxios = axiosCreate({
  baseURL: env.apiBaseUrl,
  timeout: 15_000,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});
