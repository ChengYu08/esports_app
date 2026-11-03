import { router } from "expo-router";
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native";

import { logger } from "@/core/logging/logger";
import type { Banner } from "@/features/home/api/home.types";
import { getBannerAction } from "@/features/home/home-banner.contract";
import { createImagePreviewParams } from "@/features/mine/image-preview.params";
import { openExternalLink } from "@/shared/navigation/open-external-link";
import { CachedImage } from "@/shared/ui/CachedImage";

type HomeBannerCardProps = {
  banner: Banner;
  label: string;
  style: StyleProp<ViewStyle>;
};

export function HomeBannerCard({ banner, label, style }: HomeBannerCardProps) {
  const action = getBannerAction(banner);

  async function handlePress() {
    // 排查跳转问题：无论是否配置了跳转都打印 Banner 原始下发数据（含 linkConfig 按端协议）。
    logger.info("[home-banner] banner clicked", { banner: JSON.stringify(banner) });
    if (action.type === "image") {
      router.push({ pathname: "/image-preview", params: createImagePreviewParams([action.url], 0) });
    } else if (action.type === "route") {
      // 按端跳转协议的 App 内路由（如活动落地页）。
      router.push({ pathname: action.path as never, params: action.params });
    } else if (action.type === "link") {
      await openExternalLink(action.url);
    }
    // action.type === "none"：未配置跳转，仅记录日志不动作。
  }

  return (
    <Pressable
      accessibilityRole={action.type !== "none" ? "button" : "image"}
      accessibilityLabel={banner.title || label}
      onPress={handlePress}
      style={[styles.card, style]}
    >
      <CachedImage source={{ uri: banner.imageUrl }} contentFit="cover" style={styles.image} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 8, overflow: "hidden", backgroundColor: "#CCCCCC" },
  image: { width: "100%", height: "100%" },
});
