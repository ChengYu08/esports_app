import { DOUYIN_SANS } from "@/lib/fonts";
import { Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

export default function MatchPlaceholder() {
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "快速匹配" }} />
      <Text style={styles.text}>快速匹配</Text>
      <Text style={styles.caption}>页面待补充</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  text: {
    fontFamily: DOUYIN_SANS,
    color: "#1a1a1a",
    fontSize: 20,
    fontWeight: "600",
  },
  caption: {
    fontFamily: DOUYIN_SANS,
    color: "#999",
    fontSize: 14,
    marginTop: 8,
  },
});
