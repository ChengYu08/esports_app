import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { DOUYIN_SANS } from "@/shared/theme/typography";
import { CachedImage } from "@/shared/ui/CachedImage";
import type { MessageListItemModel } from "../message.types";
import { formatUnreadCount } from "../message-unread";

export { formatUnreadCount } from "../message-unread";

type MessageListItemProps = {
  item: MessageListItemModel;
  isLast: boolean;
  onPress: (item: MessageListItemModel) => void;
};

export const MessageListItem = memo(function MessageListItem({
  item,
  isLast,
  onPress,
}: MessageListItemProps) {
  const unreadCount = formatUnreadCount(item.unreadCount || 0);

  return (
    <Pressable
      accessibilityLabel={`${item.title}${item.isOnline ? "，在线" : ""}，${item.preview}`}
      accessibilityRole="button"
      onPress={() => onPress(item)}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.avatarWrap}>
        <CachedImage source={item.avatar} style={styles.avatar} contentFit="cover" />
        {item.isOnline ? <View style={styles.onlineDot} /> : null}
      </View>
      <View style={styles.content}>
        <View style={styles.heading}>
          <Text numberOfLines={1} style={styles.title}>
            {item.title}
          </Text>
          <Text style={styles.time}>{item.time}</Text>
        </View>
        <Text numberOfLines={1} style={styles.preview}>
          {item.preview}
        </Text>
      </View>
      {!isLast && <View style={styles.divider} />}
      {unreadCount ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unreadCount}</Text>
        </View>
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    minHeight: 80,
    padding: 16,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rowPressed: { backgroundColor: "#FAFAFA" },
  avatarWrap: { position: "relative", width: 40, height: 40 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  onlineDot: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    backgroundColor: "#2FC273",
  },
  content: { flex: 1, gap: 4 },
  heading: { flexDirection: "row", alignItems: "center", gap: 16 },
  title: {
    flex: 1,
    fontFamily: DOUYIN_SANS,
    color: "#333333",
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "600",
  },
  time: {
    flexShrink: 0,
    fontFamily: DOUYIN_SANS,
    color: "#CCCCCC",
    fontSize: 12,
    lineHeight: 18,
  },
  preview: {
    fontFamily: DOUYIN_SANS,
    color: "#999999",
    fontSize: 14,
    lineHeight: 22,
  },
  divider: {
    position: "absolute",
    left: 68,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#EBEBEB",
  },
  badge: {
    position: "absolute",
    left: 44,
    top: 14,
    minWidth: 18,
    paddingHorizontal: 4,
    paddingVertical: 1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#FFFFFF",
    borderRadius: 999,
    backgroundColor: "#FF4754",
  },
  badgeText: {
    color: "#FFFFFF",
    fontFamily: DOUYIN_SANS,
    fontSize: 11,
    lineHeight: 16,
  },
});
