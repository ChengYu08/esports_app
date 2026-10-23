import { COURT_FONT_FAMILY } from "@/features/court/court.theme";
import { useFonts } from "expo-font";
import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";

// Native Text has no cross-platform text-stroke style. Offset copies form the
// outline while keeping the label as text.
const OUTLINE_OFFSETS = [
  [-1.5, 0], [1.5, 0], [0, -1.5], [0, 1.5],
  [-1.06, -1.06], [1.06, -1.06], [-1.06, 1.06], [1.06, 1.06],
] as const;

const BADGE_FONTS = {
  AlibabaPuHuiTi2Heavy: require("../../../../assets/fonts/AlibabaPuHuiTi-2-105-Heavy.ttf"),
  AlibabaPuHuiTi3Heavy: require("../../../../assets/fonts/AlibabaPuHuiTi-3-105-Heavy.ttf"),
};

export const CourtVoteBadge = memo(function CourtVoteBadge({ side }: { side: "plaintiff" | "defendant" }) {
  const [fontsLoaded] = useFonts(BADGE_FONTS);
  const color = side === "plaintiff" ? "#41AFFF" : "#FE4267";
  const fontStyle = fontsLoaded
    ? { fontFamily: side === "plaintiff" ? "AlibabaPuHuiTi2Heavy" : "AlibabaPuHuiTi3Heavy", fontWeight: "400" as const }
    : styles.fallbackFont;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[styles.badge, side === "plaintiff" ? styles.plaintiff : styles.defendant]}
    >
      {OUTLINE_OFFSETS.map(([x, y]) => (
        <Text
          key={`${x},${y}`}
          accessible={false}
          allowFontScaling={false}
          style={[styles.text, fontStyle, { color, transform: [{ translateX: x }, { translateY: y }] }]}
        >
          已支持
        </Text>
      ))}
      <Text accessible={false} allowFontScaling={false} style={[styles.text, fontStyle, styles.fill]}>已支持</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  badge: { height: 14, width: 34, position: "absolute", top: -6, transform: [{ skewX: "-5.89deg" }] },
  plaintiff: { left: 12 },
  defendant: { right: 11.5 },
  text: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, fontSize: 11, lineHeight: 14, letterSpacing: -1, textAlign: "center", includeFontPadding: false },
  fallbackFont: { fontFamily: COURT_FONT_FAMILY, fontWeight: "900" },
  fill: { color: "#FFFFFF" },
});
