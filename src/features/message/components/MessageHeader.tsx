import { Search24Regular } from "@fluentui/react-native-icons";
import type { ReactNode } from "react";
import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { DOUYIN_SANS } from "@/shared/theme/typography";

const icons = {
  clear: require("../../../../assets/message/message-clear.svg"),
};

type MessageHeaderProps = {
  onClear: () => void;
  onSearch: () => void;
};

export function MessageHeader({ onClear, onSearch }: MessageHeaderProps) {
  return (
    <View style={styles.header}>
      <Text accessibilityRole="header" style={styles.title}>
        消息
      </Text>
      <View style={styles.spacer} />
      <IconButton
        accessibilityLabel="清除所有未读消息"
        icon={<Image source={icons.clear} style={styles.icon} />}
        onPress={onClear}
      />
      <IconButton
        accessibilityLabel="搜索消息中的用户"
        icon={<Search24Regular color="#1A1A1A" width={24} height={24} />}
        onPress={onSearch}
      />
    </View>
  );
}

function IconButton({
  accessibilityLabel,
  icon,
  onPress,
}: {
  accessibilityLabel: string;
  icon: ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
    >
      {icon}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    width: "100%",
    height: 44,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 16,
    paddingRight: 6,
  },
  title: {
    fontFamily: DOUYIN_SANS,
    color: "#333333",
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "600",
  },
  spacer: { flex: 1 },
  button: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPressed: { opacity: 0.6 },
  icon: { width: 24, height: 24 },
});
