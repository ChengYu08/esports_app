import { StyleSheet, Text, View } from "react-native";
import { colors } from "@/shared/theme/tokens";
import { DOUYIN_SANS } from "@/shared/theme/typography";
import type { MyRanking, RankingBoard } from "../api/ranking.types";
import { formatRankingMetric, getRankingBoard } from "../ranking.config";
import { RankingAvatar } from "./RankingAvatar";

export function MyRankingCard({ rank, board, avatar }: { rank: MyRanking; board: RankingBoard; avatar?: string }) {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <RankingAvatar uri={avatar} size={36} />
        <View style={styles.identity}>
          <Text style={styles.label}>我的排名</Text>
          <Text style={styles.rank}>{rank.rankNo == null ? "未上榜" : `NO.${rank.rankNo}`}</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>{getRankingBoard(board).metricLabel}</Text>
          <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
            {rank.metricValue === 0 ? "—" : formatRankingMetric(rank.metricValue, board)}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingHorizontal: 16, paddingVertical: 10 },
  card: { minHeight: 52, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: "#FFF2F5", flexDirection: "row", alignItems: "center", gap: 10 },
  identity: { flex: 1, minWidth: 0, gap: 4 },
  label: { fontFamily: DOUYIN_SANS, fontSize: 12, color: colors.text },
  rank: { fontFamily: DOUYIN_SANS, fontSize: 12, color: colors.brand, fontWeight: "600" },
  metric: { maxWidth: "45%", alignItems: "flex-end", gap: 4 },
  metricLabel: { fontFamily: DOUYIN_SANS, fontSize: 10, color: colors.textMuted },
  value: { fontFamily: DOUYIN_SANS, fontSize: 16, fontWeight: "600", color: colors.text },
});
