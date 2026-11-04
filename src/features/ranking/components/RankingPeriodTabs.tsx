import { Pressable, StyleSheet, Text, View } from "react-native";
import { SYSTEM_FONT } from "@/shared/theme/typography";
import type { RankingPeriod } from "../api/ranking.types";
import { RANKING_PERIODS } from "../ranking.config";

export function RankingPeriodTabs({ value, onChange }: { value: RankingPeriod; onChange: (value: RankingPeriod) => void }) {
  return (
    <View style={styles.tabs}>
      {RANKING_PERIODS.map((period) => {
        const selected = value === period.key;
        return (
          <Pressable
            key={period.key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(period.key)}
            style={[styles.tab, selected && styles.tabSelected]}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>{period.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: "row",
    padding: 2,
    backgroundColor: "#F5F6F7",
    borderRadius: 6,
  },
  tab: {
    minWidth: 58,
    height: 26,
    paddingHorizontal: 16,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 4,
  },
  tabSelected: { backgroundColor: "#FFFFFF" },
  label: {
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    color: "#656566",
    lineHeight: 18,
    fontWeight: "400",
  },
  labelSelected: { color: "#0D0D0F", fontWeight: "500" },
});
