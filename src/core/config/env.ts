import Constants from "expo-constants";
import { Platform } from "react-native";
import { z } from "zod";

const envSchema = z.object({
  apiBaseUrl: z.string().url().default("https://djapi.jlgkj.top"),
  ssoBaseUrl: z.string().url().default("https://auth.jlgkj.top"),
  protocolBaseUrlIos: z.string().url(),
  protocolBaseUrlAndroid: z.string().url(),
  referer: z.string().url(),
  environment: z
    .enum(["development", "preview", "production"])
    .default("development"),
  ssoClientAppId: z.enum(["dianjing-ios", "dianjing-android"]),
  ssoClientSecret: z.string().default(""),
  aliyunIosAuthKey: z.string().default(""),
  aliyunAndroidAuthKey: z.string().default(""),
  rongCloudAppKey: z.string().default(""),
  miPushAppId: z.string().default(""),
  miPushAppKey: z.string().default(""),
  meizuPushAppId: z.string().default(""),
  meizuPushAppKey: z.string().default(""),
  oppoPushAppKey: z.string().default(""),
  oppoPushAppSecret: z.string().default(""),
  agoraAppId: z.string().default(""),
  alipayAppId: z.string().default(""),
});

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
const isIos = Platform.OS === "ios";
const environment =
  (extra.environment as string | undefined) ??
  process.env.EXPO_PUBLIC_ENVIRONMENT;
const defaultProtocolBaseUrlIos =
  environment === "production"
    ? "https://djpc.jlgkj.top"
    : "https://djpc.yingbowl.com";
const defaultProtocolBaseUrlAndroid =
  environment === "production"
    ? "https://dj.panzhi.com"
    : "https://djpc.yingbowl.com";

export const env = envSchema.parse({
  apiBaseUrl: isIos
    ? (extra.apiBaseUrlIos ?? process.env.EXPO_PUBLIC_API_BASE_URL_IOS)
    : (extra.apiBaseUrlAndroid ?? process.env.EXPO_PUBLIC_API_BASE_URL_ANDROID),
  ssoBaseUrl: isIos
    ? (extra.ssoBaseUrlIos ?? process.env.EXPO_PUBLIC_SSO_BASE_URL_IOS)
    : (extra.ssoBaseUrlAndroid ?? process.env.EXPO_PUBLIC_SSO_BASE_URL_ANDROID),
  protocolBaseUrlIos:
    extra.protocolBaseUrlIos ??
    process.env.EXPO_PUBLIC_PROTOCOL_BASE_URL_IOS ??
    defaultProtocolBaseUrlIos,
  protocolBaseUrlAndroid:
    extra.protocolBaseUrlAndroid ??
    process.env.EXPO_PUBLIC_PROTOCOL_BASE_URL_ANDROID ??
    defaultProtocolBaseUrlAndroid,
  // 必须带 Referer，否则会命中 WAF 被拦截（按平台取协议域名）
  referer: isIos
    ? ((extra.protocolBaseUrlIos as string | undefined) ??
      process.env.EXPO_PUBLIC_PROTOCOL_BASE_URL_IOS ??
      defaultProtocolBaseUrlIos)
    : ((extra.protocolBaseUrlAndroid as string | undefined) ??
      process.env.EXPO_PUBLIC_PROTOCOL_BASE_URL_ANDROID ??
      defaultProtocolBaseUrlAndroid),
  environment,
  ssoClientAppId: isIos ? "dianjing-ios" : "dianjing-android",
  ssoClientSecret: isIos
    ? (extra.ssoIosClientSecret ??
      process.env.EXPO_PUBLIC_SSO_IOS_CLIENT_SECRET)
    : (extra.ssoAndroidClientSecret ??
      process.env.EXPO_PUBLIC_SSO_ANDROID_CLIENT_SECRET),
  aliyunIosAuthKey:
    extra.aliyunIosAuthKey ?? process.env.EXPO_PUBLIC_ALIYUN_IOS_AUTH_KEY,
  aliyunAndroidAuthKey:
    extra.aliyunAndroidAuthKey ??
    process.env.EXPO_PUBLIC_ALIYUN_ANDROID_AUTH_KEY,
  rongCloudAppKey:
    extra.rongCloudAppKey ?? process.env.EXPO_PUBLIC_RONGCLOUD_APP_KEY,
  miPushAppId: extra.miPushAppId ?? process.env.EXPO_PUBLIC_MI_PUSH_APP_ID,
  miPushAppKey: extra.miPushAppKey ?? process.env.EXPO_PUBLIC_MI_PUSH_APP_KEY,
  meizuPushAppId: extra.meizuPushAppId ?? process.env.EXPO_PUBLIC_MEIZU_PUSH_APP_ID,
  meizuPushAppKey: extra.meizuPushAppKey ?? process.env.EXPO_PUBLIC_MEIZU_PUSH_APP_KEY,
  oppoPushAppKey: extra.oppoPushAppKey ?? process.env.EXPO_PUBLIC_OPPO_PUSH_APP_KEY,
  oppoPushAppSecret: extra.oppoPushAppSecret ?? process.env.EXPO_PUBLIC_OPPO_PUSH_APP_SECRET,
  agoraAppId: extra.agoraAppId ?? process.env.EXPO_PUBLIC_AGORA_APP_ID,
  alipayAppId: extra.alipayAppId ?? process.env.EXPO_PUBLIC_ALIPAY_APP_ID,
});

console.log("[ENV-CHECK]", JSON.stringify({
  environment: env.environment,
  apiBaseUrl: env.apiBaseUrl,
  ssoBaseUrl: env.ssoBaseUrl,
  protocolBaseUrl: isIos ? env.protocolBaseUrlIos : env.protocolBaseUrlAndroid,
}));
