import { Image } from "expo-image";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { Game } from "@/features/home/api/home.types";
import { SYSTEM_FONT } from "@/shared/theme/typography";

const allGamesIcon = require("../../../../assets/mine/figma/god-all-games.svg");

type Props = { games: Game[]; value: string; onChange: (id: string) => void };
const allGames: Game = { id: 0, name: "全部" };

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
            {selected ? <View style={styles.indicator} /> : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0, backgroundColor: "transparent" },
  games: {
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    alignItems: "center",
  },
  game: {
    height: 32,
    paddingHorizontal: 8,
    borderRadius: 6,
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
    position: "relative",
  },
  gameSelected: {},
  icon: { width: 20, height: 20, borderRadius: 10 },
  label: {
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    color: "#656566",
    lineHeight: 18,
    fontWeight: "400",
  },
  labelSelected: { color: "#0D0D0F", fontWeight: "500" },
  indicator: {
    position: "absolute",
    left: "50%",
    bottom: 0,
    width: 16,
    height: 2,
    borderRadius: 1,
    backgroundColor: "#FE1F4C",
    transform: [{ translateX: -8 }],
  },
});
