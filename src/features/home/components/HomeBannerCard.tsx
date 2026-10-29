import { router } from "expo-router";
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native";

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
  const interactive = action.type !== "none";

  async function handlePress() {
    if (action.type === "image") {
      router.push({ pathname: "/image-preview", params: createImagePreviewParams([action.url], 0) });
    } else if (action.type === "link") {
      await openExternalLink(action.url);
    }
  }

  return (
    <Pressable
      accessibilityRole={interactive ? "button" : "image"}
      accessibilityLabel={banner.title || label}
      disabled={!interactive}
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
