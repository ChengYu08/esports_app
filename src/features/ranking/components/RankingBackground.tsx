import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet } from "react-native";

/** 排行榜顶部背景：严格对应设计稿 0% / 50% / 100% 三段色。 */
export function RankingBackground() {
  return (
    <LinearGradient
      pointerEvents="none"
      colors={["#FFFFFF", "#FFF2E5", "#FFF9F2"]}
      locations={[0, 0.5, 1]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.background}
    />
  );
}

const styles = StyleSheet.create({
  background: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    aspectRatio: 375 / 276,
  },
});
