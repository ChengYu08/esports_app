import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SYSTEM_FONT } from "@/shared/theme/typography";
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
            {selected ? (
              <LinearGradient
                colors={["#995C3D", "#4D2E1F"]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.selectedTab}
              >
                <Text style={[styles.label, styles.selectedLabel]}>{board.label}</Text>
              </LinearGradient>
            ) : (
              <Text style={styles.label}>{board.label}</Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: "row",
    alignItems: "center",
    padding: 2,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: "#FFFFFF",
    backgroundColor: "rgba(255, 255, 255, 0.6)",
  },
  tab: {
    height: 28,
    minWidth: 76,
    alignItems: "center",
    justifyContent: "center",
  },
  selectedTab: {
    height: 28,
    paddingHorizontal: 16,
    borderRadius: 99,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "500",
    color: "#8F5233",
  },
  selectedLabel: { color: "#FFFFFF" },
});
