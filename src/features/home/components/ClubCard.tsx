import { fetchClubGameCompanionCounts } from "@/features/home/api/home.api";
import type { Club } from "@/features/home/api/home.types";
import { computeGameIconLayout } from "@/features/mine/utils/game-icons-layout";
import { colors } from "@/shared/theme/tokens";
import { DOUYIN_SANS } from "@/shared/theme/typography";
import { CachedImage } from "@/shared/ui/CachedImage";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

const icons = {
  user: require("../../../../assets/home/h_user.svg"),
  id: require("../../../../assets/home/club-id.svg"),
};

// 角标渐变为静态元素，提升到模块级共享，避免每张卡片渲染时重复创建。
const tagGradient = (
  <LinearGradient
    colors={["#FF8C6C", "#F92E7F"]}
    start={{ x: 0, y: 0.5 }}
    end={{ x: 1, y: 0.5 }}
    style={StyleSheet.absoluteFill}
  />
);

export const ClubCard = memo(function ClubCard({
  club,
  onlineCount = club.onlineCount,
  onSelect,
}: {
  club: Club;
  /** 在线陪玩人数，null 表示尚未获取；未传时使用俱乐部自身的统计。 */
  onlineCount?: number | null;
  onSelect?: (club: Club) => void;
}) {
  const colors = ["#24354b", "#4a2637", "#2e4650", "#493e2e"];
  const hue = colors[Number(club.id.match(/\d+$/)?.[0] ?? 0) % 4];
  const handlePress = () => {
    onSelect?.(club);
    router.push({ pathname: "/club/[id]", params: { id: club.id } });
  };

  const gameIds = Array.from(new Set(club.gameIds ?? [])).sort((a, b) => a - b);
  const serverCountsAvailable = gameIds.length > 0 && gameIds.every((id) =>
    club.games?.some((game) => game.id === id && typeof game.companionCount === "number"),
  );
  const gameCounts = useQuery({
    queryKey: ["club-game-companion-counts", club.id, gameIds],
    queryFn: ({ signal }) =>
      fetchClubGameCompanionCounts(club.id, gameIds, signal),
    enabled: gameIds.length > 0 && !serverCountsAvailable,
    staleTime: 5 * 60_000,
  });
  const counts = serverCountsAvailable
    ? Object.fromEntries((club.games ?? []).map((game) => [game.id, game.companionCount ?? 0]))
    : gameCounts.data;
  const gameIcons = new Map((club.games ?? []).map((game) => [game.id, game]));
  const games = counts
    ? [...gameIds]
        .sort((a, b) => counts[b] - counts[a] || a - b)
        .slice(0, 3)
        .flatMap((id) => {
          const game = gameIcons.get(id);
          return game?.iconUrl ? [game] : [];
        })
    : [];
  const gamesLayout = computeGameIconLayout(games.length);

  return (
    <Pressable
      accessibilityLabel={`查看${club.name}详情`}
      style={styles.club}
      onPress={handlePress}
    >
      <View style={[styles.cover, { backgroundColor: hue }]}>
        {club.coverUrl ? (
          <CachedImage
            source={{ uri: club.coverUrl }}
            style={styles.coverImage}
            contentFit="cover"
          />
        ) : (
          <Text style={styles.coverText}>{club.name.slice(0, 1)}</Text>
        )}
        {club.clubTag && (
          <View style={styles.tag}>
            {tagGradient}
            <Text numberOfLines={1} style={styles.tagText}>
              {club.clubTag}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          {club.isSelfOperated && <Text style={styles.self}>自营</Text>}
          <Text numberOfLines={1} style={styles.name}>
            {club.name}
          </Text>
          <View style={styles.online}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>{onlineCount ?? "--"}人</Text>
          </View>
        </View>
        <Text numberOfLines={1} style={styles.desc}>
          {club.description}
        </Text>
        <View style={styles.metaRow}>
          <View style={styles.meta}>
            <Image source={icons.user} style={styles.metaIcon} />
            <Text style={styles.metaText}>{club.memberCount}人</Text>
          </View>
          <View style={styles.meta}>
            <Image source={icons.id} style={styles.metaIcon} />
            <Text style={styles.metaText}>{club.clubCode}</Text>
          </View>

          {games.length > 0 ? (
            <View style={[styles.gameIcons, { width: gamesLayout.totalWidth }]}>
              {games.map((game, index) => (
                <Image
                  key={`${game.iconUrl}-${index}`}
                  source={{ uri: game.iconUrl }}
                  style={[styles.gameIcon, { left: index * gamesLayout.step }]}
                  contentFit="cover"
                />
              ))}
            </View>
          ) : null}
        </View>
      </View>
      <View style={styles.divider} />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  // 设计稿：卡片全宽白底，pad 16/12/16/12，内容 gap 12，底部细分割线
  club: {
    minHeight: 104,
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  cover: {
    width: 80,
    height: 80,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  coverText: {
    fontFamily: DOUYIN_SANS,
    color: "rgba(255,255,255,.78)",
    fontSize: 34,
    fontWeight: "800",
  },
  coverImage: { width: "100%", height: "100%", borderRadius: 8 },
  // 设计稿 L1 Tag/Emphasis：58x16，字 10/600/12，左上圆角 8、右下圆角 6，
  // 渐变左→右 #FF8C6C → #F92E7F 叠加在底色 #FF4754 上（底色兼作渐变加载前的兜底）
  tag: {
    position: "absolute",
    top: 0,
    left: 0,
    maxWidth: "100%",
    height: 16,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    borderTopLeftRadius: 8,
    borderBottomRightRadius: 6,
    overflow: "hidden",
    backgroundColor: "#FF4754",
  },
  tagText: {
    fontFamily: DOUYIN_SANS,
    fontSize: 10,
    fontWeight: "600",
    lineHeight: 12,
    includeFontPadding: false,
    color: colors.surface,
  },
  body: { flex: 1 },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 24,
  },
  // 设计稿 L2 Tag/bold：浅粉底 #FFE5EB 红字 #FF42A1，600/10/14，pad 4/1/4/1
  self: {
    fontFamily: DOUYIN_SANS,
    color: "#FF42A1",
    backgroundColor: "#FFE5EB",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    fontSize: 10,
    fontWeight: "600",
    lineHeight: 14,
    includeFontPadding: false,
  },
  name: {
    fontFamily: DOUYIN_SANS,
    color: "#0A0A0A",
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "500",
    flexShrink: 1,
  },
  online: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 0,
  },
  onlineDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#2FC273",
  },
  onlineText: {
    fontFamily: DOUYIN_SANS,
    color: "#2FC273",
    fontSize: 12,
    lineHeight: 17,
  },
  desc: {
    fontFamily: DOUYIN_SANS,
    color: "#979799",
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
  gameIcons: {
    marginLeft: "auto",
    height: 14,
    flexDirection: "row",
  },
  gameIcon: {
    position: "absolute",
    top: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 4,
  },
  meta: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: {
    fontFamily: DOUYIN_SANS,
    color: "#7F7F80",
    fontSize: 11,
    lineHeight: 16,
  },
  metaIcon: { width: 16, height: 16 },
  divider: {
    // 绝对定位：不参与行布局（行内分割线的 margin 会挤窄内容区，右侧出现大空白）
    position: "absolute",
    bottom: 0,
    left: 16,
    right: 16,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#EBEBEB",
  },
});
