import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native";

import type { Banner } from "@/features/home/api/home.types";
import { getBannerAction } from "@/features/home/home-banner.contract";
import { navigateBannerAction } from "@/features/home/navigate-banner-action";
import { CachedImage } from "@/shared/ui/CachedImage";

type HomeBannerCardProps = {
  banner: Banner;
  label: string;
  style: StyleProp<ViewStyle>;
};

export function HomeBannerCard({ banner, label, style }: HomeBannerCardProps) {
  const action = getBannerAction(banner);

  async function handlePress() {
    await navigateBannerAction(banner);
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
