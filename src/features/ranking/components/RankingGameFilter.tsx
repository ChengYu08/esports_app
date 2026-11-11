import { Image } from "expo-image";
import { memo, useCallback, useMemo } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import type { Game } from "@/features/home/api/home.types";
import { CachedImage } from "@/shared/ui/CachedImage";
import { SYSTEM_FONT } from "@/shared/theme/typography";

const allGamesIcon = require("../../../../assets/svgs/god-all-games.svg");

type Props = { games: Game[]; value: string; onChange: (id: string) => void };

type RankingGameItem = { id: string; name: string; iconUrl: string | null };

const ALL_GAME_ID = "0";

const rankingGameKey = (item: RankingGameItem) => item.id;

export const RankingGameFilter = memo(function RankingGameFilter({ games, value, onChange }: Props) {
  const items = useMemo<RankingGameItem[]>(
    () => [
      { id: ALL_GAME_ID, name: "全部", iconUrl: null },
      ...games.map((game) => ({
        id: String(game.id),
        name: game.name,
        iconUrl: game.iconUrl ?? null,
      })),
    ],
    [games],
  );

  const renderItem = useCallback(
    ({ item }: { item: RankingGameItem }) => (
      <RankingGamePill
        id={item.id}
        name={item.name}
        iconUrl={item.iconUrl}
        selected={value === item.id}
        onSelect={onChange}
      />
    ),
    [onChange, value],
  );

  return (
    <FlatList
      horizontal
      data={items}
      keyExtractor={rankingGameKey}
      renderItem={renderItem}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.games}
      style={styles.scroll}
      initialNumToRender={10}
      maxToRenderPerBatch={10}
      windowSize={5}
    />
  );
});

const RankingGamePill = memo(function RankingGamePill({
  id,
  name,
  iconUrl,
  selected,
  onSelect,
}: {
  id: string;
  name: string;
  iconUrl: string | null;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => onSelect(id)}
      style={[styles.game, selected && styles.gameSelected]}
    >
      {iconUrl ? (
        <CachedImage source={{ uri: iconUrl }} contentFit="cover" style={styles.icon} />
      ) : (
        <Image source={allGamesIcon} contentFit="cover" style={styles.icon} />
      )}
      <Text style={[styles.label, selected && styles.labelSelected]}>{name}</Text>
      {selected ? <View style={styles.indicator} /> : null}
    </Pressable>
  );
});

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
