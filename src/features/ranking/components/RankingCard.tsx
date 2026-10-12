import { memo } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "@/shared/theme/tokens";
import { DOUYIN_SANS } from "@/shared/theme/typography";
import type { RankingBoard, RankingItem } from "../api/ranking.types";
import { getRankingProfileParams } from "../api/ranking.contract";
import { formatRankingMetric, getRankingBoard } from "../ranking.config";
import { RankingAvatar } from "./RankingAvatar";

const medals = [
  { colors: ["#FFD875", "#DE9D2B"], tint: "#FFFAEF" },
  { colors: ["#CBD6E6", "#8696B0"], tint: "#F4F7FB" },
  { colors: ["#EBB792", "#B97348"], tint: "#FFF7F0" },
] as const;

type Props = { item: RankingItem; board: RankingBoard; onViewProfile: (item: RankingItem) => void };

export const RankingCard = memo(function RankingCard({ item, board, onViewProfile }: Props) {
  const medal = medals[item.rankNo - 1];
  const canViewProfile = getRankingProfileParams(item) !== null;
  const metricLabel = getRankingBoard(board).metricLabel;
  return (
    <View style={[styles.card, medal && { backgroundColor: medal.tint }]}>
      <View style={styles.main}>
        <View style={styles.rankColumn}>
          {medal ? (
            <LinearGradient colors={medal.colors} style={styles.medal}>
              <Text style={styles.top}>TOP</Text>
              <Text style={styles.medalNumber}>{item.rankNo}</Text>
            </LinearGradient>
          ) : <Text style={styles.rank}>NO.{item.rankNo}</Text>}
        </View>
        {canViewProfile ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`查看${item.nickname}的主页`}
            onPress={() => onViewProfile(item)}
            style={({ pressed }) => [styles.avatarButton, pressed && styles.pressed]}
          >
            <RankingAvatar uri={item.avatar} />
          </Pressable>
        ) : <RankingAvatar uri={item.avatar} />}
        <View style={styles.identity}>
          <Text numberOfLines={1} style={styles.name}>{item.nickname}</Text>
          {board !== "GOD" && <Text numberOfLines={1} style={styles.club}>{item.clubName || "暂无俱乐部"}</Text>}
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>{metricLabel}</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={styles.value}>
            {formatRankingMetric(item.metricValue, board)}
          </Text>
        </View>
      </View>
      <View style={styles.footer}>
        <Text style={styles.gap} numberOfLines={2}>
          {item.distanceToPrev == null ? "距离前一名 —" : `距离前一名 ${formatRankingMetric(item.distanceToPrev, board)}`}
        </Text>
        {board !== "GOD" && (
          canViewProfile ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`查看${item.nickname}的主页`}
              onPress={() => onViewProfile(item)}
              style={({ pressed }) => [styles.action, pressed && styles.pressed]}
            >
              <Text style={styles.actionLabel}>查看主页</Text>
              <Text style={styles.arrow}>›</Text>
            </Pressable>
          ) : <Text style={styles.unavailable}>暂无主页</Text>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: { paddingHorizontal: 12, paddingTop: 16, paddingBottom: 2, marginBottom: 10, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: "#F0F0F2" },
  main: { flexDirection: "row", alignItems: "center", gap: 8 },
  rankColumn: { width: 34, alignItems: "center", flexShrink: 0 },
  avatarButton: { width: 42, height: 42, borderRadius: 21 },
  medal: { width: 30, height: 38, borderRadius: 5, borderBottomLeftRadius: 12, borderBottomRightRadius: 12, alignItems: "center", justifyContent: "center" },
  top: { fontSize: 8, fontWeight: "700", color: "#FFF" },
  medalNumber: { fontFamily: DOUYIN_SANS, fontSize: 18, lineHeight: 22, fontWeight: "700", color: "#FFF" },
  rank: { fontFamily: DOUYIN_SANS, color: "#85858E", fontSize: 10, fontWeight: "500" },
  identity: { flex: 1, minWidth: 0, gap: 6 },
  name: { fontFamily: DOUYIN_SANS, fontSize: 14, color: colors.text, fontWeight: "500" },
  club: { fontFamily: DOUYIN_SANS, fontSize: 11, color: colors.textMuted },
  metric: { alignItems: "flex-end", maxWidth: "34%", gap: 5 },
  metricLabel: { fontFamily: DOUYIN_SANS, fontSize: 10, color: colors.textMuted },
  value: { fontFamily: DOUYIN_SANS, fontSize: 17, fontWeight: "600", color: colors.text },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 44, gap: 8, marginLeft: 42 },
  gap: { flex: 1, fontFamily: DOUYIN_SANS, fontSize: 10, lineHeight: 16, color: colors.textMuted },
  action: { flexDirection: "row", gap: 4, alignItems: "center", justifyContent: "flex-end", minHeight: 44, paddingLeft: 8 },
  actionLabel: { fontFamily: DOUYIN_SANS, fontSize: 11, color: colors.brand },
  arrow: { fontSize: 18, lineHeight: 20, color: colors.brand },
  pressed: { opacity: 0.6 },
  unavailable: { fontFamily: DOUYIN_SANS, fontSize: 10, color: colors.textMuted },
});
