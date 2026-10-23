import { formatTime, type PlatformTicket } from "@/features/court/court.api";
import { COURT_COLORS, COURT_FONT_FAMILY } from "@/features/court/court.theme";
import { CachedImage } from "@/shared/ui/CachedImage";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  item: PlatformTicket;
  mine: boolean;
  onOpen: () => void;
};

const TYPE_LABELS: Record<string, string> = {
  ORDER_DISPUTE: "订单存在纠纷",
  RULE_VIOLATION: "用户投诉",
  CHAT_DISPUTE: "用户投诉",
  OTHER: "用户投诉",
  PLATFORM_SUGGESTION: "平台建议",
};

const STATUS_LABELS: Record<string, string> = {
  SUBMITTED: "已提交",
  REJECTED: "已驳回",
  PROCESSING: "处理中",
  TO_USER_REPLY: "待补充",
  RESOLVED: "已解决",
  CLOSED: "已关闭",
};

export function PlatformTicketCard({ item, mine, onOpen }: Props) {
  const orderDispute = item.reasonType === "ORDER_DISPUTE";
  const typeLabel = TYPE_LABELS[item.reasonType ?? ""] ?? "其他";
  const typeColor = orderDispute ? "#F5821D" : COURT_COLORS.defendant;
  const images = item.evidenceThumbnails ?? [];
  const remainingImages = Math.max(0, images.length - 5);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`查看${typeLabel}工单详情`}
      onPress={onOpen}
      style={styles.card}
    >
      <View style={styles.header}>
        <View style={[styles.typeTag, orderDispute && styles.orderTag]}>
          <Text style={[styles.typeText, { color: typeColor }]}>类型</Text>
          <View style={[styles.typeDivider, { backgroundColor: typeColor }]} />
          <Text style={[styles.typeText, { color: typeColor }]}>
            {typeLabel}
          </Text>
        </View>
        <Text numberOfLines={1} style={styles.time}>
          {formatTime(item.createdAt)}
        </Text>
      </View>
      <View>
        <Text numberOfLines={2} style={styles.content}>
          <Text style={styles.label}>投诉内容</Text>
          {"\u00A0"}
          {item.content || "-"}
        </Text>
        {images.length > 0 && (
          <View style={styles.images}>
            {images.slice(0, 5).map((uri, index) => (
              <View key={`${uri}-${index}`} style={styles.thumbnail}>
                <CachedImage
                  source={{ uri }}
                  contentFit="cover"
                  style={StyleSheet.absoluteFill}
                />
                {index === 4 && remainingImages > 0 && (
                  <View style={[StyleSheet.absoluteFill, styles.moreImages]}>
                    <Text style={styles.moreImagesText}>
                      +{remainingImages}
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </View>
      {!!item.adminReply?.trim() && (
        <Text numberOfLines={2} style={styles.content}>
          <Text style={styles.label}>官方回复</Text>
          {"\u00A0"}
          {item.adminReply}
        </Text>
      )}
      {mine && (
        <View style={styles.footer}>
          <Text style={styles.status}>
            {STATUS_LABELS[item.status ?? ""] ?? "处理中"}
          </Text>
          <Text style={styles.detail}>查看详情 ›</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COURT_COLORS.surface,
    borderRadius: 8,
    gap: 12,
    marginBottom: 12,
    overflow: "hidden",
    padding: 12,
  },
  header: { alignItems: "center", flexDirection: "row", gap: 12 },
  typeTag: {
    alignItems: "center",
    backgroundColor: "#FFE5EB",
    borderRadius: 4,
    flexDirection: "row",
    gap: 4,
    height: 18,
    paddingHorizontal: 6,
  },
  orderTag: { backgroundColor: "#FFF4EB" },
  typeText: {
    fontFamily: COURT_FONT_FAMILY,
    fontSize: 11,
    fontWeight: "400",
    lineHeight: 16,
  },
  typeDivider: { height: 6, width: 0.5 },
  time: {
    color: COURT_COLORS.muted,
    flex: 1,
    fontFamily: COURT_FONT_FAMILY,
    fontSize: 12,
    fontWeight: "400",
    lineHeight: 18,
    textAlign: "right",
  },
  content: {
    color: COURT_COLORS.text,
    fontFamily: COURT_FONT_FAMILY,
    fontSize: 12,
    fontWeight: "400",
    lineHeight: 18,
  },
  label: { color: COURT_COLORS.muted },
  images: { flexDirection: "row", gap: 4, marginTop: 4 },
  thumbnail: {
    aspectRatio: 1,
    backgroundColor: COURT_COLORS.background,
    borderRadius: 6,
    flexShrink: 1,
    overflow: "hidden",
    width: 57,
  },
  moreImages: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
  },
  moreImagesText: {
    color: COURT_COLORS.surface,
    fontFamily: COURT_FONT_FAMILY,
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 22,
  },
  footer: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  status: {
    backgroundColor: "#FFF4EB",
    borderRadius: 10,
    color: "#F5821D",
    fontFamily: COURT_FONT_FAMILY,
    fontSize: 10,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  detail: {
    color: COURT_COLORS.secondary,
    fontFamily: COURT_FONT_FAMILY,
    fontSize: 12,
    lineHeight: 18,
  },
});
