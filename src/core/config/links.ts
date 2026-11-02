import { Platform } from "react-native";

import { env } from "@/core/config/env";

/**
 * App-level links that may change independently from the app code.
 * Protocol pages are hosted on PC; content is managed server-side by code.
 */

// iOS 端协议编码统一追加 `_ios` 后缀（后台按平台区分协议内容）
const protocolCode = (code: string) =>
  Platform.OS === "ios" ? `${code}_ios` : code;

// 协议页基础域名按平台取自环境配置（生产/测试域名区分在 env 内完成）
const protocolBaseUrl = Platform.select({
  ios: env.protocolBaseUrlIos,
  android: env.protocolBaseUrlAndroid,
  default: env.protocolBaseUrlAndroid,
});

export const APP_LINKS = {
  userAgreement: `${protocolBaseUrl}/public/protocols?code=${protocolCode("user_server")}`,
  privacyPolicy: `${protocolBaseUrl}/public/protocols?code=${protocolCode("user_privacy")}`,
  // 盼之电竞购买须知（星钻充值页，安卓充值页 rechargeAgreement 同 code）
  purchaseNotice: `${protocolBaseUrl}/public/protocols?code=${protocolCode("user_recharge")}`,
  rechargeAgreement: `${protocolBaseUrl}/public/protocols?code=${protocolCode("user_recharge")}`,
  // 注销协议（注销流程页《注销协议》入口）
  accountCancellation: `${protocolBaseUrl}/public/protocols?code=${protocolCode("user_cancellation")}`,
} as const;
