import { createImagePreviewParams } from "@/features/mine/image-preview.params";
import { CachedImage } from "@/shared/ui/CachedImage";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { CourtSource } from "../court.api";
import { COURT_FONT_FAMILY } from "../court.theme";
import { CourtAvatar } from "./CourtAvatar";

type Props = {
  source: CourtSource;
  gameIconUrl?: string;
  kind: "order" | "review";
  selected: boolean;
  disabled?: boolean;
  keyword?: string;
  onSelect: () => void;
};

export function CourtSourceCard({
  source,
  gameIconUrl,
  kind,
  selected,
  disabled,
  keyword = "",
  onSelect,
}: Props) {
  const [failedIconUrl, setFailedIconUrl] = useState<string>();
  const iconUri = gameIconUrl || source.gameIconUrl;
  const isReview = kind === "review";
  const name =
    source.companionNickname || source.defendantNickname || "服务用户";
  const orderNo = source.orderNo || String(source.orderId ?? "");
  const search = keyword.trim();
  const match = search
    ? orderNo.toLowerCase().indexOf(search.toLowerCase())
    : -1;
  const images = source.reviewImageUrls?.filter(Boolean) ?? [];
  const title =
    [source.modeName, source.levelName, source.serviceName]
      .filter(Boolean)
      .join("-") || "服务订单";
  const rating = Math.min(5, Math.max(0, source.reviewRating ?? 0));
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={
        isReview
          ? `${name}的评价，${rating}星，${source.reviewContent || "暂无评价内容"}`
          : `订单 ${orderNo}，${name}`
      }
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onSelect}
      style={styles.row}
    >
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected && <Text style={styles.check}>✓</Text>}
      </View>
      <View style={styles.main}>
        <View style={styles.header}>
          <CourtAvatar
            uri={source.companionAvatar || source.defendantAvatar}
            size={20}
          />
          <Text numberOfLines={1} style={styles.name}>
            {name}
          </Text>
          {isReview ? (
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map((value) => (
                <CachedImage
                  key={value}
                  source={require("../../../../assets/order/review-star.svg")}
                  tintColor={value <= rating ? "#FF943D" : "#D9D9D9"}
                  style={styles.star}
                />
              ))}
            </View>
          ) : (
            <Text style={styles.time}>
              {source.createdAt?.replace("T", " ").slice(0, 19) || ""}
            </Text>
          )}
        </View>
        {isReview ? (
          <>
            <Text style={styles.reviewText}>
              {source.reviewContent || "暂无评价内容"}
            </Text>
            {images.length > 0 && (
              <View style={styles.images}>
                {images.map((uri, index) => (
                  <Pressable
                    key={`${uri}-${index}`}
                    accessibilityRole="button"
                    accessibilityLabel={`查看评价图片 ${index + 1}`}
                    disabled={disabled}
                    onPress={(event) => {
                      event.stopPropagation();
                      router.push({
                        pathname: "/image-preview",
                        params: createImagePreviewParams(images, index),
                      });
                    }}
                    style={styles.imageButton}
                  >
                    <CachedImage
                      source={{ uri }}
                      contentFit="cover"
                      style={styles.image}
                    />
                  </Pressable>
                ))}
              </View>
            )}
          </>
        ) : (
          <View style={styles.orderInfo}>
            <Text style={styles.orderTitle}>{title}</Text>
            <View style={styles.detailRow}>
              <Text style={styles.label}>游戏</Text>
              <CachedImage
                source={
                  iconUri && iconUri !== failedIconUrl
                    ? { uri: iconUri }
                    : require("../../../../assets/voice-room/game.svg")
                }
                placeholder={require("../../../../assets/voice-room/game.svg")}
                contentFit="cover"
                placeholderContentFit="contain"
                recyclingKey={iconUri || "default-game"}
                onError={() => setFailedIconUrl(iconUri)}
                style={styles.gameIcon}
              />
              <Text style={styles.value}>{source.gameName || "—"}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.label}>订单号</Text>
              <Text selectable style={styles.value}>
                {match < 0 ? (
                  orderNo
                ) : (
                  <>
                    {orderNo.slice(0, match)}
                    <Text style={styles.highlight}>
                      {orderNo.slice(match, match + search.length)}
                    </Text>
                    {orderNo.slice(match + search.length)}
                  </>
                )}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.label}>总价</Text>
              <Text style={styles.value}>
                {source.totalPrice == null ? "—" : `${source.totalPrice}星钻`}
              </Text>
            </View>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 8,
  },
  radio: {
    alignItems: "center",
    justifyContent: "center",
    borderColor: "#CCCCCC",
    borderWidth: 1,
    borderRadius: 8,
    height: 16,
    width: 16,
  },
  radioSelected: { backgroundColor: "#FE1F4C", borderColor: "#FE1F4C" },
  check: { color: "#FFFFFF", fontSize: 11, lineHeight: 14, fontWeight: "600" },
  main: { flex: 1, minWidth: 0 },
  header: { alignItems: "center", flexDirection: "row", gap: 4 },
  name: {
    color: "#0D0D0F",
    fontFamily: COURT_FONT_FAMILY,
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },
  time: {
    color: "#979799",
    fontFamily: COURT_FONT_FAMILY,
    fontSize: 12,
    lineHeight: 18,
  },
  orderInfo: {
    backgroundColor: "#F7F7F7",
    borderRadius: 8,
    padding: 16,
    gap: 6,
    marginTop: 8,
  },
  orderTitle: {
    color: "#0D0D0F",
    fontFamily: COURT_FONT_FAMILY,
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 22,
    marginBottom: 4,
  },
  detailRow: { alignItems: "center", flexDirection: "row", gap: 4 },
  label: {
    color: "#979799",
    fontFamily: COURT_FONT_FAMILY,
    fontSize: 12,
    lineHeight: 18,
    width: 40,
  },
  value: {
    color: "#0D0D0F",
    fontFamily: COURT_FONT_FAMILY,
    fontSize: 12,
    lineHeight: 18,
    flexShrink: 1,
  },
  highlight: { color: "#FE1F4C" },
  gameIcon: { width: 14, height: 14, borderRadius: 2, flexShrink: 0 },
  stars: { flexDirection: "row", gap: 2 },
  star: { height: 14, width: 14 },
  reviewText: {
    color: "#656566",
    fontFamily: COURT_FONT_FAMILY,
    fontSize: 14,
    lineHeight: 22,
    marginTop: 4,
  },
  images: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: "1.25%",
    rowGap: 4,
    marginTop: 8,
  },
  imageButton: { width: "19%", aspectRatio: 1 },
  image: { width: "100%", height: "100%", borderRadius: 4 },
});
