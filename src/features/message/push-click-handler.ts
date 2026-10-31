import { NativeModules, Platform } from "react-native";
import { router } from "expo-router";

import {
  getSystemConversationTitle,
  normalizeSystemConversationId,
} from "./system-conversations";

/**
 * 系统推送点击后的路由跳转。
 * iOS：原生层将 targetId 存入 UserDefaults，JS 启动时读取并清除。
 * Android：原生层将 pushData JSON 存入 SharedPreferences，JS 启动时读取并清除。
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
  router.push({ pathname: "/chat/[id]", params: { id: normalizedId, title } });
}

/** iOS：从 UserDefaults 读取待处理的推送点击 */
async function handlePendingPushClickIos(): Promise<void> {
  const raw = await NativeModules.RongCloudPushModule?.getPendingPushClick?.();
  if (!raw?.targetId) return;
  await NativeModules.RongCloudPushModule?.clearPendingPushClick?.().catch(
    () => undefined,
  );
  navigateToPushTarget(raw.targetId, raw.conversationType ?? "");
}

/** Android：从 SharedPreferences 读取待处理的推送点击 */
async function handlePendingPushClickAndroid(): Promise<void> {
  const raw = await NativeModules.RongCloudPushModule?.getPendingPushClick?.();
  if (!raw) return;
  await NativeModules.RongCloudPushModule?.clearPendingPushClick?.().catch(
    () => undefined,
  );
  try {
    const data = JSON.parse(raw) as Partial<PendingPushClick>;
    navigateToPushTarget(data.targetId ?? "", data.conversationType ?? "");
  } catch {
    // JSON 解析失败时静默忽略
  }
}

/**
 * App 启动时（IM 初始化完成后）调用：
 * 读取原生层暂存的推送点击数据并跳转。
 */
export async function handlePendingPushClick(): Promise<void> {
  try {
    if (Platform.OS === "ios") {
      await handlePendingPushClickIos();
    } else if (Platform.OS === "android") {
      await handlePendingPushClickAndroid();
    }
  } catch {
    // 原生模块未实现或调用失败时静默忽略
  }
}
