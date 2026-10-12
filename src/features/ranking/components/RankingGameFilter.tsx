import { Image } from "expo-image";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import type { Game } from "@/features/home/api/home.types";
import { colors } from "@/shared/theme/tokens";
import { DOUYIN_SANS } from "@/shared/theme/typography";

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
            {game.iconUrl ? <Image source={{ uri: game.iconUrl }} contentFit="cover" style={styles.icon} /> : null}
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
  game: { minHeight: 44, paddingHorizontal: 12, borderRadius: 12, flexDirection: "row", gap: 6, alignItems: "center", backgroundColor: "#F5F5F7", borderWidth: 1, borderColor: "#F5F5F7" },
  gameSelected: { backgroundColor: "#FFF0F3", borderColor: "#FFD6DE" },
  icon: { width: 22, height: 22, borderRadius: 6 },
  label: { fontFamily: DOUYIN_SANS, fontSize: 12, color: colors.textSecondary },
  labelSelected: { color: colors.brand, fontWeight: "600" },
});
