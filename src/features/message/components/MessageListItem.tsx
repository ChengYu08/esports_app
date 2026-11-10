import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { CachedImage } from "@/shared/ui/CachedImage";
import { formatUnreadCount } from "../message-unread";
import type { MessageListItemModel } from "../message.types";

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
      accessibilityLabel={`${item.title}${item.isCustomerService ? "，官方客服" : ""}${item.isOnline ? "，在线" : ""}，${item.preview}`}
      accessibilityRole="button"
      onPress={() => onPress(item)}
      style={({ pressed }) => [
        styles.row,
        item.isPinned && styles.rowPinned,
        pressed && styles.rowPressed,
      ]}
    >
      <View style={styles.avatarWrap}>
        <CachedImage
          source={item.avatar}
          style={styles.avatar}
          contentFit="cover"
        />
        {item.isOnline ? (
          <View style={styles.onlineDot}>
            <View style={styles.onlineDotCore} />
          </View>
        ) : null}
      </View>
      <View style={styles.content}>
        <View style={styles.heading}>
          <View style={styles.titleRow}>
            <Text numberOfLines={1} style={styles.title}>
              {item.title}
            </Text>
            {item.isCustomerService ? (
              <View style={styles.csTag}>
                <Text style={styles.csTagText}>官方客服</Text>
              </View>
            ) : null}
          </View>
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
    minHeight: 72,
    padding: 16,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  // 置顶会话背景更深（设计稿 76-49626：置顶行 Gray-04 #F7F7F7，普通行白色）
  rowPinned: { backgroundColor: "#F7F7F7" },
  rowPressed: { backgroundColor: "#FAFAFA" },
  avatarWrap: { position: "relative", width: 40, height: 40 },
  // 设计稿 551-126636：40×40 圆形头像，0.5px Gray-06 #EBEBEB 描边
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#EBEBEB",
  },
  // 白色外圈 + 绿色内芯：保持 1.5px 白色描边的视觉效果，
  // 避免「绿色背景 + border」在圆角抗锯齿时外沿透出绿色
  onlineDot: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  onlineDotCore: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#2FC273",
  },
  content: { flex: 1, gap: 4 },
  heading: { flexDirection: "row", alignItems: "center", gap: 16 },
  titleRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  title: {
    flexShrink: 1,
    color: "#333333",
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "600",
  },
  // 设计稿 70-41035：昵称右侧「官方客服」标签，0.5px Brand-04 描边、圆角2、10px Brand-07 文字；
  // 高度按设计 14 在 Android 会裁掉文字底部，与 CompanionCard 大神 Tag 一致抬高到 16
  csTag: {
    height: 16,
    paddingHorizontal: 2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0.5,
    borderColor: "#FFC2C6",
    borderRadius: 2,
  },
  csTagText: {
    color: "#FF4754",
    fontSize: 10,
    lineHeight: 13,
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  time: {
    flexShrink: 0,
    color: "#CCCCCC",
    fontSize: 12,
    lineHeight: 18,
  },
  preview: {
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
    fontSize: 11,
    lineHeight: 16,
  },
});
