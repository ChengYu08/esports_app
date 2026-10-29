import { Platform } from "react-native";

import { env } from "@/core/config/env";

/**
 * App-level links that may change independently from the app code.
 * Protocol pages are hosted on PC; content is managed server-side by code.
 */

// iOS 端协议编码统一追加 `_ios` 后缀（后台按平台区分协议内容）
const protocolCode = (code: string) =>
  Platform.OS === "ios" ? `${code}_ios` : code;

// 协议页基础域名取自环境配置（生产/测试域名区分在 env.protocolBaseUrl 内完成）
export const APP_LINKS = {
  userAgreement: `${env.protocolBaseUrl}/public/protocols?code=${protocolCode("user_server")}`,
  privacyPolicy: `${env.protocolBaseUrl}/public/protocols?code=${protocolCode("user_privacy")}`,
  // 盼之电竞购买须知（星钻充值页，安卓充值页 rechargeAgreement 同 code）
  purchaseNotice: `${env.protocolBaseUrl}/public/protocols?code=${protocolCode("user_recharge")}`,
  rechargeAgreement: `${env.protocolBaseUrl}/public/protocols?code=${protocolCode("user_recharge")}`,
} as const;
