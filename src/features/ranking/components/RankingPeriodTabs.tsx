import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "@/shared/theme/tokens";
import { DOUYIN_SANS } from "@/shared/theme/typography";
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
  tabs: { flexDirection: "row", padding: 3, backgroundColor: "#F3F3F5", borderRadius: 12 },
  tab: { minWidth: 58, minHeight: 38, paddingHorizontal: 12, justifyContent: "center", alignItems: "center", borderRadius: 9 },
  tabSelected: { backgroundColor: colors.surface },
  label: { fontFamily: DOUYIN_SANS, fontSize: 12, color: colors.textMuted },
  labelSelected: { color: colors.text, fontWeight: "600" },
});
