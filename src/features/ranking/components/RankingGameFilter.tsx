import { Image } from "expo-image";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import type { Game } from "@/features/home/api/home.types";
import { colors } from "@/shared/theme/tokens";
import { DOUYIN_SANS } from "@/shared/theme/typography";

const allGamesIcon = require("../../../../assets/mine/figma/god-all-games.svg");

type Props = { games: Game[]; value: string; onChange: (id: string) => void };
const allGames: Game = { id: 0, name: "总榜" };

export function RankingGameFilter({ games, value, onChange }: Props) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.games} style={styles.scroll}>
      {[allGames, ...games].map((game) => {
        const id = String(game.id);
        const selected = value === id;
        return (
          <Pressable
            key={id}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(id)}
            style={[styles.game, selected && styles.gameSelected]}
          >
            {game.iconUrl ? (
              <Image source={{ uri: game.iconUrl }} contentFit="cover" style={styles.icon} />
            ) : (
              <Image source={allGamesIcon} contentFit="cover" style={styles.icon} />
            )}
            <Text style={[styles.label, selected && styles.labelSelected]}>{game.name}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0, backgroundColor: colors.surface },
  games: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6, gap: 8, alignItems: "center" },
  game: {
    height: 32,
    paddingHorizontal: 8,
    borderRadius: 6,
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
    backgroundColor: "#F5F5F7",
    borderWidth: 1,
    borderColor: "#F5F5F7",
  },
  gameSelected: { backgroundColor: "#FFF5F7", borderColor: "#FF99AD" },
  icon: { width: 20, height: 20, borderRadius: 4 },
  label: { fontFamily: DOUYIN_SANS, fontSize: 12, color: "#0D0D0F", lineHeight: 18 },
  labelSelected: { color: "#FE1F4C", fontWeight: "500" },
});
