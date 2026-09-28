import { StyleSheet, Text, View } from "react-native";

import { DOUYIN_SANS } from "@/shared/theme/typography";

export function OrderHeader() {
  return (
    <View style={styles.header}>
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
    paddingHorizontal: 16,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
  },
  title: {
    fontFamily: DOUYIN_SANS,
    color: "#333333",
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "600",
  },
});
