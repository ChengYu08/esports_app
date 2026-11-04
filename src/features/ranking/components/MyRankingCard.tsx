import { getDDinProStyle, SYSTEM_FONT } from "@/shared/theme/typography";
import { StyleSheet, Text, View } from "react-native";
import type { MyRanking, RankingBoard } from "../api/ranking.types";
import { formatRankingMetric } from "../ranking.config";
import { RankingAvatar } from "./RankingAvatar";

export function MyRankingCard({
  rank,
  board,
  avatar,
  nickname,
}: {
  rank: MyRanking;
  board: RankingBoard;
  avatar?: string;
  nickname?: string;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.rankColumn}>
        <Text numberOfLines={1} adjustsFontSizeToFit style={styles.rank}>
          {rank.rankNo == null
            ? "未上榜"
            : String(rank.rankNo).padStart(2, "0")}
        </Text>
        <Text style={styles.rankLabel}>我的排名</Text>
      </View>
      <View style={styles.identity}>
        <RankingAvatar uri={avatar} size={32} />
        <Text numberOfLines={1} style={styles.nickname}>
          {nickname || "我"}
        </Text>
      </View>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
        style={styles.metric}
      >
        {rank.metricValue === 0
          ? "—"
          : formatRankingMetric(rank.metricValue, board)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 66,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E9E9EB",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 3,
  },
  rankColumn: {
    width: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  rank: {
    width: "100%",
    fontSize: 14,
    lineHeight: 22,
    color: "#FF99AD",
    textAlign: "center",
    ...getDDinProStyle(600),
  },
  rankLabel: {
    width: "100%",
    fontFamily: SYSTEM_FONT,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "500",
    color: "#0D0D0F",
    textAlign: "center",
  },
  identity: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  nickname: {
    flex: 1,
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    lineHeight: 18,
    color: "#0D0D0F",
  },
  metric: {
    width: 64,
    fontSize: 16,
    lineHeight: 20,
    color: "#0D0D0F",
    textAlign: "right",
    ...getDDinProStyle(600),
  },
});
