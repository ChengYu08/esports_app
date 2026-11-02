import * as StoreReview from "expo-store-review";

import { logger } from "@/core/logging/logger";

/**
 * iOS 跳转 App Store 更新页。
 * 优先 StoreReview.requestReview() 弹系统评分/更新弹窗；
 * 不支持时（模拟器/旧系统/评分不可用）回退打开 App Store 应用页。
 */
export async function openAppStoreReview(): Promise<void> {
  try {
    const available = await StoreReview.isAvailableAsync();
    if (available) {
      await StoreReview.requestReview();
      return;
    }
  } catch (error) {
    logger.warn("app_upgrade.store_review_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
  }

  // 回退：StoreReview 不可用时打开 App Store 应用详情页（itms-apps:// 链接）
  const storeUrl = StoreReview.storeUrl();
  if (storeUrl) {
    try {
      const { Linking } = await import("react-native");
      const supported = await Linking.canOpenURL(storeUrl);
      if (supported) {
        await Linking.openURL(storeUrl);
      }
    } catch (error) {
      logger.warn("app_upgrade.open_store_failed", {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
