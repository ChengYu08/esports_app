import { StyleSheet, Text, View } from "react-native";

import { DOUYIN_SANS } from "@/shared/theme/typography";

export function OrderHeader({ title = "订单" }: { title?: string }) {
  const centered = title !== "订单";
  return (
    <View style={[styles.header, centered && styles.centeredHeader]}>
      <Text accessibilityRole="header" style={[styles.title, centered && styles.centeredTitle]}>
        {title}
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
  centeredHeader: { alignItems: "center" },
  centeredTitle: { fontSize: 14, lineHeight: 20, fontWeight: "500" },
});
