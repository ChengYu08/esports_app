import { env } from "@/core/config/env";

/**
 * App-level links that may change independently from the app code.
 * Protocol pages are hosted on PC; content is managed server-side by code.
 */

// 协议页基础域名取自环境配置（生产/测试域名区分在 env.protocolBaseUrl 内完成）
export const APP_LINKS = {
  userAgreement: `${env.protocolBaseUrl}/public/protocols?code=user_server`,
  privacyPolicy: `${env.protocolBaseUrl}/public/protocols?code=user_privacy`,
  rechargeAgreement: `${env.protocolBaseUrl}/public/protocols?code=user_recharge`,
} as const;
