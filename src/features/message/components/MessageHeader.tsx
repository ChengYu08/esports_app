import { Image } from "expo-image";
import { Pressable, StyleSheet, View } from "react-native";

const icons = {
  back: require("../../../../assets/message/message-back.svg"),
  clear: require("../../../../assets/message/message-clear.svg"),
  search: require("../../../../assets/message/message-search.svg"),
};

type MessageHeaderProps = {
  onBack: () => void;
  onClear: () => void;
  onSearch: () => void;
};

export function MessageHeader({ onBack, onClear, onSearch }: MessageHeaderProps) {
  return (
    <View style={styles.header}>
      <IconButton accessibilityLabel="返回" icon={icons.back} onPress={onBack} />
      <View style={styles.spacer} />
      <IconButton accessibilityLabel="清空消息" icon={icons.clear} onPress={onClear} />
      <IconButton accessibilityLabel="搜索消息" icon={icons.search} onPress={onSearch} />
    </View>
  );
}

function IconButton({
  accessibilityLabel,
  icon,
  onPress,
}: {
  accessibilityLabel: string;
  icon: number;
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
      <Image source={icon} style={styles.icon} />
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
    paddingHorizontal: 6,
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
