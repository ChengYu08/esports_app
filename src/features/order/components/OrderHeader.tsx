import { ChevronLeft24Regular } from "@fluentui/react-native-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

export function OrderHeader({ onBack }: { onBack?: () => void }) {
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityLabel="返回"
        hitSlop={12}
        onPress={onBack}
        style={styles.back}
      >
        <ChevronLeft24Regular color="#1A1A1A" width={24} height={24} />
      </Pressable>
      <Text accessibilityRole="header" style={styles.title}>
        订单
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    width: "100%",
    height: 44,
    paddingHorizontal: 8,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
  },
  back: {
    width: 40,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: "#333333",
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "600",
  },
});
