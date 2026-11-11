import { Platform } from "react-native";
import { router } from "expo-router";

import ExpoAppToolkit from "../../../modules/expo-app-toolkit";
import {
  getSystemConversationTitle,
  normalizeSystemConversationId,
} from "./system-conversations";

/**
 * 系统推送点击后的路由跳转。
 * iOS：原生层将 targetId 存入 UserDefaults（AppDelegate），JS 读取并清除。
 * Android：原生层将 pushData JSON 存入 SharedPreferences（MainActivity/MainApplication），JS 读取并清除。
 * 桥接统一由 modules/expo-app-toolkit 提供（getPendingPushClick / clearPendingPushClick）。
 */

export type PendingPushClick = {
  targetId: string;
  conversationType: string;
};

function navigateToPushTarget(targetId: string, conversationType: string) {
  if (!targetId) {
    router.push("/(tabs)/message");
    return;
  }
  const normalizedId = normalizeSystemConversationId(targetId);
  const title = getSystemConversationTitle(normalizedId, "");
  router.push({
    pathname: "/chat/[id]",
    params: { id: normalizedId, title },
  });
}

/**
 * 读取原生暂存的推送点击数据并跳转。
 * 冷启动：App 被推送杀死后点击通知 → launchOptions 捕获 → UserDefaults/SharedPreferences。
 * 温启动：App 在后台点击通知 → didReceive/onNewIntent 暂存 → 调用方需在 AppState 回到 active 时再次调用本函数。
 */
export async function handlePendingPushClick(): Promise<void> {
  try {
    const raw = await ExpoAppToolkit?.getPendingPushClick?.();
    if (!raw) return;
    await ExpoAppToolkit?.clearPendingPushClick?.().catch(() => undefined);
    if (Platform.OS === "ios") {
      const data = raw as Partial<PendingPushClick>;
      navigateToPushTarget(data.targetId ?? "", data.conversationType ?? "");
      return;
    }
    try {
      const data = JSON.parse(raw as string) as Partial<PendingPushClick>;
      navigateToPushTarget(data.targetId ?? "", data.conversationType ?? "");
    } catch {
      // JSON 解析失败时静默忽略
    }
  } catch {
    // 原生模块未实现（Expo Go / 未重新 prebuild）或调用失败时静默忽略
  }
}
