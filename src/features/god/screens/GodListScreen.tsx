import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fetchGames } from "@/features/home/api/home.api";
import {
  fetchGodPage,
  GOD_EMPTY_FILTERS,
  type GodFilters,
  type GodListItem,
} from "@/features/god/api/god.api";
import { VoicePlayButton } from "@/shared/audio/VoicePlayButton";
import { useVoicePlayer } from "@/shared/audio/use-voice-player";
import { EmptyState } from "@/shared/ui/AsyncStates";

const maleIcon = require("../../../../assets/home/club-detail/male.svg");
const femaleIcon = require("../../../../assets/mine/figma/mine-female.svg");
const diamondIcon = require("../../../../assets/home/club-detail/icon-diamond.svg");
const emptyAvatar = require("../../../../assets/mine/figma/mine-avatar.png");
const allGamesIcon = require("../../../../assets/mine/figma/god-all-games.svg");

const PAGE_SIZE = 10;

type FilterKey = keyof GodFilters;

const FILTER_DEFS: { key: FilterKey; label: string; options: { value: string; label: string }[] }[] = [
  {
    key: "status",
    label: "状态",
    options: [
      { value: "", label: "不限" },
      { value: "online", label: "空闲中" },
      { value: "busy", label: "游戏中" },
    ],
  },
  {
    key: "gender",
    label: "性别",
    options: [
      { value: "", label: "不限" },
      { value: "male", label: "男" },
      { value: "female", label: "女" },
    ],
  },
  {
    key: "price",
    label: "价格",
    options: [
      { value: "", label: "不限" },
      { value: "asc", label: "从低到高" },
      { value: "desc", label: "从高到低" },
    ],
  },
];

const ALL_GAME_KEY = "all";

export default function GodListScreen() {
  const insets = useSafeAreaInsets();
  const voicePlayer = useVoicePlayer();
  const [gameKey, setGameKey] = useState(ALL_GAME_KEY);
  const [filters, setFilters] = useState<GodFilters>(GOD_EMPTY_FILTERS);
  const [openFilter, setOpenFilter] = useState<FilterKey | null>(null);

  const games = useQuery({ queryKey: ["god-games"], queryFn: ({ signal }) => fetchGames(signal) });

  const gameId = useMemo(() => {
    if (gameKey === ALL_GAME_KEY) return null;
    const hit = games.data?.find((game) => String(game.id) === gameKey);
    return hit ? hit.id : null;
  }, [gameKey, games.data]);

  const godList = useInfiniteQuery({
    queryKey: ["god-list", gameId, filters],
    queryFn: ({ pageParam, signal }) =>
      fetchGodPage({ gameId, filters, page: pageParam, pageSize: PAGE_SIZE, signal }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const fetched = allPages.reduce((sum, page) => sum + page.items.length, 0);
      return fetched < lastPage.total ? allPages.length + 1 : undefined;
    },
  });

  const list = useMemo(
    () => godList.data?.pages.flatMap((page) => page.items) ?? [],
    [godList.data],
  );

  const renderCard = ({ item }: { item: GodListItem }) => (
    <GodCard
      item={item}
      voicePlayingUrl={voicePlayer.playingUrl}
      onToggleVoice={voicePlayer.toggle}
      onPress={() =>
        router.push({
          pathname: "/profile",
          params: {
            clubId: String(item.clubId),
            userId: String(item.userId),
            ...(item.gameName ? { gameId: gameKey === ALL_GAME_KEY ? "" : gameKey } : {}),
          },
        })
      }
    />
  );

  return (
    <View style={styles.screen}>
      <View style={styles.gameBar}>
        <GamePill
          label="全部"
          iconUrl={null}
          selected={gameKey === ALL_GAME_KEY}
          onPress={() => setGameKey(ALL_GAME_KEY)}
        />
        {(games.data ?? []).map((game) => (
          <GamePill
            key={game.id}
            label={game.name}
            iconUrl={game.iconUrl}
            selected={gameKey === String(game.id)}
            onPress={() => setGameKey(String(game.id))}
          />
        ))}
      </View>
      <View style={styles.listSheet}>
        <View style={styles.filterBar}>
          {FILTER_DEFS.map((def) => {
            const active = Boolean(filters[def.key]);
            const selected = def.options.find((option) => option.value === filters[def.key]);
            return (
              <View key={def.key} style={styles.filterWrap}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setOpenFilter(openFilter === def.key ? null : def.key)}
                  style={styles.filterChip}
                >
                  <Text style={[styles.filterText, active && styles.filterTextActive]}>
                    {active ? `${def.label}·${selected?.label ?? ""}` : def.label}
                  </Text>
                  <Text style={[styles.filterArrow, openFilter === def.key && styles.filterArrowOpen]}>
                    ▾
                  </Text>
                </Pressable>
                {openFilter === def.key ? (
                  <View style={styles.filterMenu}>
                    {def.options.map((option) => (
                      <Pressable
                        key={option.value}
                        accessibilityRole="button"
                        onPress={() => {
                          setFilters((current) => ({ ...current, [def.key]: option.value }));
                          setOpenFilter(null);
                        }}
                        style={styles.filterMenuItem}
                      >
                        <Text
                          style={[
                            styles.filterMenuItemText,
                            filters[def.key] === option.value && styles.filterMenuItemTextActive,
                          ]}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
        <FlatList
          data={list}
          keyExtractor={(item) => String(item.userId)}
          renderItem={renderCard}
          ListEmptyComponent={
            godList.isLoading ? null : (
              <EmptyState message="暂无大神，换个筛选条件试试" />
            )
          }
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 + insets.bottom }}
          refreshControl={
            <RefreshControl
              refreshing={godList.isRefetching && !godList.isFetchingNextPage}
              onRefresh={() => void godList.refetch()}
              tintColor="#ff214b"
            />
          }
          onEndReached={() => {
            if (godList.hasNextPage && !godList.isFetchingNextPage) {
              void godList.fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.2}
        />
      </View>
    </View>
  );
}

function GamePill({
  label,
  iconUrl,
  selected,
  onPress,
}: {
  label: string;
  iconUrl: string | null | undefined;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.gamePill, selected && styles.gamePillSelected]}
    >
      {iconUrl ? (
        <Image source={{ uri: iconUrl }} style={styles.gameIcon} contentFit="cover" />
      ) : (
        <Image source={allGamesIcon} style={styles.gameIcon} contentFit="cover" />
      )}
      <Text style={[styles.gamePillText, selected && styles.gamePillTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function levelTagColor(levelName: string) {
  if (levelName.includes("金")) return "#D19643";
  if (levelName.includes("银")) return "#A8B0BD";
  if (levelName.includes("钻")) return "#7D8FE0";
  return "#C0C4CC";
}

function GodCard({
  item,
  voicePlayingUrl,
  onToggleVoice,
  onPress,
}: {
  item: GodListItem;
  voicePlayingUrl: string | null;
  onToggleVoice: (url: string) => void;
  onPress: () => void;
}) {
  const online = item.onlineStatus === 1;
  const busy = item.gameStatus === 1;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
      <View style={styles.cardLeft}>
        <Image
          source={item.avatar ? { uri: item.avatar } : emptyAvatar}
          style={styles.avatar}
          contentFit="cover"
        />
        {item.voiceUrl ? (
          <View style={styles.voicePill}>
            <VoicePlayButton
              url={item.voiceUrl}
              duration={item.voiceDurationSeconds}
              inline
              playingUrl={voicePlayingUrl}
              onToggleVoice={onToggleVoice}
            />
          </View>
        ) : null}
      </View>
      <View style={styles.cardRight}>
        <View style={styles.nameRow}>
          <Text numberOfLines={1} style={styles.name}>
            {item.nickname}
          </Text>
          {item.sex === 1 || item.sex === 2 ? (
            <Image
              source={item.sex === 1 ? maleIcon : femaleIcon}
              style={[styles.genderIcon, item.sex === 1 ? styles.genderMale : styles.genderFemale]}
            />
          ) : null}
          {online ? (
            <View style={[styles.statusTag, busy ? styles.statusBusyBg : styles.statusIdleBg]}>
              <Text style={[styles.statusTagText, busy ? styles.statusBusyText : styles.statusIdleText]}>
                {busy ? "游戏中" : "空闲中"}
              </Text>
            </View>
          ) : null}
        </View>
        {item.gameName ? (
          <View style={styles.gameTag}>
            <Text style={styles.gameTagText}>{item.gameName}</Text>
          </View>
        ) : null}
        <View style={styles.introRow}>
          {item.levelName ? (
            <View style={[styles.levelTag, { backgroundColor: levelTagColor(item.levelName) }]}>
              <Text style={styles.levelTagText}>{item.levelName}</Text>
            </View>
          ) : null}
          <Text numberOfLines={1} style={styles.introText}>
            {item.signature || "保持一点神秘感..."}
          </Text>
        </View>
        <View style={styles.priceRow}>
          <View style={styles.priceWrap}>
            <Text style={styles.price}>{item.price}</Text>
            <Image source={diamondIcon} style={styles.diamond} />
          </View>
          <Text style={styles.sales}>销量 {item.orderCount}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F5F6F7" },
  gameBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  gamePill: {
    height: 32,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: "#FFF",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  gamePillSelected: {
    backgroundColor: "#FFF5F7",
    borderWidth: 1,
    borderColor: "#FF99AD",
  },
  gamePillText: { color: "#0A0A0A", fontSize: 12, lineHeight: 18 },
  gamePillTextSelected: { color: "#FE1F4C", fontWeight: "500" },
  gameIcon: { width: 20, height: 20, borderRadius: 4 },
  listSheet: {
    flex: 1,
    backgroundColor: "#FFF",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingTop: 6,
  },
  filterBar: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  filterWrap: { marginRight: 8, position: "relative" },
  filterChip: {
    height: 32,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  filterText: { color: "#656566", fontSize: 12, lineHeight: 18 },
  filterTextActive: { color: "#FE1F4C" },
  filterArrow: { color: "#656566", fontSize: 10 },
  filterArrowOpen: { transform: [{ rotate: "180deg" }] },
  filterMenu: {
    position: "absolute",
    top: 36,
    left: 0,
    zIndex: 10,
    backgroundColor: "#FFF",
    borderRadius: 8,
    paddingVertical: 4,
    minWidth: 96,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  filterMenuItem: { paddingHorizontal: 16, paddingVertical: 10 },
  filterMenuItemText: { color: "#333", fontSize: 13 },
  filterMenuItemTextActive: { color: "#FE1F4C", fontWeight: "600" },
  card: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  cardPressed: { backgroundColor: "#F7F7F7" },
  cardLeft: { width: 100, height: 100 },
  avatar: { width: 100, height: 100, borderRadius: 8 },
  voicePill: {
    position: "absolute",
    left: 4,
    bottom: 4,
    backgroundColor: "rgba(255,255,255,0.85)",
    borderRadius: 99,
    paddingHorizontal: 4,
  },
  cardRight: {
    flex: 1,
    justifyContent: "space-between",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  name: {
    color: "#0D0D0F",
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "600",
    flexShrink: 1,
    maxWidth: "60%",
  },
  genderIcon: { width: 12, height: 12 },
  genderMale: { tintColor: "#3DA5FF" },
  genderFemale: { tintColor: "#FF42A1" },
  statusTag: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 2,
    gap: 2,
  },
  statusBusyBg: { backgroundColor: "#FFF4EB" },
  statusIdleBg: { backgroundColor: "#E6FAEF" },
  statusTagText: { fontSize: 10, lineHeight: 14, fontWeight: "500" },
  statusBusyText: { color: "#F5821D" },
  statusIdleText: { color: "#14A357" },
  gameTag: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFF4EB",
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  gameTagText: { color: "#B25C15", fontSize: 10, lineHeight: 14, fontWeight: "500" },
  introRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  levelTag: {
    borderRadius: 2,
    paddingHorizontal: 2,
    paddingVertical: 1,
  },
  levelTagText: { color: "#FFF", fontSize: 10, lineHeight: 13, fontWeight: "500" },
  introText: {
    flex: 1,
    color: "#979799",
    fontSize: 11,
    lineHeight: 16,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  priceWrap: { flexDirection: "row", alignItems: "center", gap: 4 },
  price: {
    color: "#FE1F4C",
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "700",
  },
  diamond: { width: 15, height: 15 },
  sales: { color: "#979799", fontSize: 12, lineHeight: 18 },
});
