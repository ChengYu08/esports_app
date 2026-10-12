import { Pressable, StyleSheet, Text, View } from "react-native";
import { DOUYIN_SANS } from "@/shared/theme/typography";
import { colors } from "@/shared/theme/tokens";
import type { RankingBoard } from "../api/ranking.types";
import { RANKING_BOARDS } from "../ranking.config";

export function RankingBoardTabs({ value, onChange }: { value: RankingBoard; onChange: (value: RankingBoard) => void }) {
  return (
    <View style={styles.tabs}>
      {RANKING_BOARDS.map((board) => {
        const selected = value === board.key;
        return (
          <Pressable
            key={board.key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(board.key)}
            style={styles.tab}
          >
            <Text style={[styles.label, selected && styles.selected]}>{board.label}</Text>
            {selected && <View style={styles.indicator} />}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 20, backgroundColor: colors.surface },
  tab: { minHeight: 48, justifyContent: "center", alignItems: "center", paddingBottom: 6 },
  label: { fontFamily: DOUYIN_SANS, fontSize: 16, color: colors.textMuted },
  selected: { color: colors.text, fontWeight: "600" },
  indicator: { position: "absolute", bottom: 3, height: 3, width: 22, borderRadius: 2, backgroundColor: colors.brand },
});
