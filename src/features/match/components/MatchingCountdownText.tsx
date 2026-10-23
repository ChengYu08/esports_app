import { StyleSheet, Text, View } from "react-native";

import { DOUYIN_SANS } from "@/shared/theme/typography";

type MatchingCountdownTextProps = {
  countdownText: string;
};

export function MatchingCountdownText({ countdownText }: MatchingCountdownTextProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.muted}>派单倒计时</Text>
      <Text style={styles.accent}>{countdownText}</Text>
      <Text style={styles.muted}>，到期自动取消</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  muted: {
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    lineHeight: 18,
    color: "rgba(255,255,255,0.6)",
  },
  accent: {
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    lineHeight: 18,
    color: "#FE4267",
  },
});
