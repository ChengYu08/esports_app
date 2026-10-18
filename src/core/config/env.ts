import Constants from "expo-constants";
import { Platform } from "react-native";
import { z } from "zod";

const envSchema = z.object({
  apiBaseUrl: z.string().url().default("https://djapi.jlgkj.top"),
  ssoBaseUrl: z.string().url().default("https://auth.jlgkj.top"),
  environment: z
    .enum(["development", "preview", "production"])
    .default("development"),
  ssoClientAppId: z.enum(["dianjing-ios", "dianjing-android"]),
  ssoClientSecret: z.string().default(""),
  aliyunIosAuthKey: z.string().default(""),
  aliyunAndroidAuthKey: z.string().default(""),
  rongCloudAppKey: z.string().default(""),
  agoraAppId: z.string().default(""),
});

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
const isIos = Platform.OS === "ios";

export const env = envSchema.parse({
  apiBaseUrl: extra.apiBaseUrl ?? process.env.EXPO_PUBLIC_API_BASE_URL,
  ssoBaseUrl: extra.ssoBaseUrl ?? process.env.EXPO_PUBLIC_SSO_BASE_URL,
  environment: extra.environment ?? process.env.EXPO_PUBLIC_ENVIRONMENT,
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
  agoraAppId: extra.agoraAppId ?? process.env.EXPO_PUBLIC_AGORA_APP_ID,
});
