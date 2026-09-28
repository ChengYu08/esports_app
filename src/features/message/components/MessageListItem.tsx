import { Image } from "expo-image";
import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { DOUYIN_SANS } from "@/shared/theme/typography";
import type { MessageListItemModel } from "../message.types";

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
      accessibilityLabel={`${item.title}，${item.preview}`}
      accessibilityRole="button"
      onPress={() => onPress(item)}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <Image source={item.avatar} style={styles.avatar} contentFit="cover" />
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
  avatar: { width: 40, height: 40, borderRadius: 20 },
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
});
