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
      {formatUnreadCount(item.unreadCount || 0) ? <View style={styles.badge}><Text style={styles.badgeText}>{formatUnreadCount(item.unreadCount || 0)}</Text></View> : null}
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
    right: -1,
    bottom: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    backgroundColor: "#20C46B",
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
  badge: { position: "absolute", right: 16, bottom: 14, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, alignItems: "center", justifyContent: "center", backgroundColor: "#FE1F4C" },
  badgeText: { color: "#FFFFFF", fontFamily: DOUYIN_SANS, fontSize: 10, lineHeight: 14, fontWeight: "600" },
});
