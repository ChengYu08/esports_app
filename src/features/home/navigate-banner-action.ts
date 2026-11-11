import { router } from "expo-router";

import { logger } from "@/core/logging/logger";
import type { Banner } from "@/features/home/api/home.types";
import { getBannerAction } from "@/features/home/home-banner.contract";
import { createImagePreviewParams } from "@/features/mine/image-preview.params";
import { openExternalLink } from "@/shared/navigation/open-external-link";

/**
 * 执行 Banner / 开屏弹窗统一跳转：route / 外链 / 内容图预览；none 仅打日志。
 */
export async function navigateBannerAction(banner: Banner): Promise<void> {
  const action = getBannerAction(banner);
  logger.info("[home-banner] banner navigate", {
    banner: JSON.stringify(banner),
    actionType: action.type,
  });
  if (action.type === "image") {
    router.push({
      pathname: "/image-preview",
      params: { ...createImagePreviewParams([action.url], 0), mode: "fit-width" },
    });
    return;
  }
  if (action.type === "route") {
    router.push({ pathname: action.path as never, params: action.params });
    return;
  }
  if (action.type === "link") {
    await openExternalLink(action.url);
  }
}
