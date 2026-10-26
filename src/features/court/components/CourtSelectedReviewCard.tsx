import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { CourtSource } from "@/features/court/court.api";
import { COURT_FONT_FAMILY } from "@/features/court/court.theme";
import { createImagePreviewParams } from "@/features/mine/image-preview.params";
import { CachedImage } from "@/shared/ui/CachedImage";
import { CourtAvatar } from "./CourtAvatar";

export function CourtSelectedReviewCard({ source, disabled }: { source: CourtSource; disabled?: boolean }) {
  const images = source.reviewImageUrls?.filter(Boolean) ?? [];
  const rating = source.reviewRating == null || !Number.isFinite(source.reviewRating)
    ? null
    : Math.min(5, Math.max(0, source.reviewRating));

  return (
    <View style={styles.card}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.author}>
            <CourtAvatar uri={source.companionAvatar || source.defendantAvatar} size={16} />
            <Text numberOfLines={1} style={styles.name}>{source.companionNickname || source.defendantNickname || "服务用户"}</Text>
          </View>
          {rating == null ? <Text style={styles.name}>暂无评分</Text> : (
            <View accessible accessibilityLabel={`评分 ${rating} 星，满分 5 星`} style={styles.stars}>
              {[0, 1, 2, 3, 4].map((index) => (
                <View key={index} style={styles.star}>
                  <CachedImage source={require("../../../../assets/order/review-star.svg")} tintColor="#D9D9D9" style={styles.star} />
                  <View style={[styles.starFill, { width: 12 * Math.min(1, Math.max(0, rating - index)) }]}>
                    <CachedImage source={require("../../../../assets/order/review-star.svg")} tintColor="#FF943D" style={styles.star} />
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
        <Text numberOfLines={1} style={styles.review}>{source.reviewContent?.trim() || "暂无评价内容"}</Text>
      </View>
      {images.length > 0 && (
        <Pressable accessibilityRole="button" accessibilityLabel="查看差评图片" disabled={disabled} onPress={() => router.push({ pathname: "/image-preview", params: createImagePreviewParams(images, 0) })}>
          <CachedImage source={{ uri: images[0] }} contentFit="cover" style={styles.thumbnail} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, marginBottom: 16, backgroundColor: "#F5F6F7", borderRadius: 6, padding: 12, flexDirection: "row", alignItems: "center", gap: 12 },
  content: { flex: 1, minWidth: 0, gap: 4 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  author: { flexDirection: "row", alignItems: "center", gap: 4, flex: 1, minWidth: 0 },
  name: { fontFamily: COURT_FONT_FAMILY, fontSize: 11, lineHeight: 16, color: "#979799", flexShrink: 1 },
  stars: { flexDirection: "row", gap: 4 },
  star: { width: 12, height: 12 },
  starFill: { position: "absolute", top: 0, left: 0, height: 12, overflow: "hidden" },
  review: { fontFamily: COURT_FONT_FAMILY, fontSize: 12, lineHeight: 18, color: "#333333" },
  thumbnail: { width: 40, height: 40, borderRadius: 4 },
});
