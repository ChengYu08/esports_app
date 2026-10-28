import { env } from "@/core/config/env";

/**
 * App-level links that may change independently from the app code.
 * Update this file when the hosted agreement pages move.
 */

// 协议页基础域名：生产环境用生产域名，其余环境（开发/测试包）走测试域名
const PROTOCOLS_BASE_URL =
  env.environment === "production"
    ? "https://dj.panzhi.com"
    : "https://djpc.yingbowl.com";

// 协议页统一入口，code 由管理后台配置
export const APP_LINKS = {
  userAgreement: `${PROTOCOLS_BASE_URL}/public/protocols?code=user_server`,
  privacyPolicy: `${PROTOCOLS_BASE_URL}/public/protocols?code=user_privacy`,
} as const;
