import { getDDinProStyle, SYSTEM_FONT } from "@/shared/theme/typography";
import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { getRankingProfileParams } from "../api/ranking.contract";
import type { RankingBoard, RankingItem } from "../api/ranking.types";
import { formatRankingMetric } from "../ranking.config";
import { RankingAvatar } from "./RankingAvatar";

const RANK_COLORS = ["#FE4267", "#70BCFF", "#FAAD6E"] as const;

type Props = {
  item: RankingItem;
  board: RankingBoard;
  onViewProfile: (item: RankingItem) => void;
};

export const RankingCard = memo(function RankingCard({
  item,
  board,
  onViewProfile,
}: Props) {
  const canViewProfile = getRankingProfileParams(item) !== null;
  const gapLabel =
    item.distanceToPrev != null
      ? `距离上一名差${formatRankingMetric(item.distanceToPrev, board)}`
      : undefined;

  const openProfile = () => {
    if (canViewProfile) {
      onViewProfile(item);
    }
  };

  const content = (
    <>
      <View style={styles.rankColumn}>
        <Text
          style={[
            styles.rank,
            item.rankNo <= RANK_COLORS.length && {
              color: RANK_COLORS[item.rankNo - 1],
            },
          ]}
        >
          {String(item.rankNo).padStart(2, "0")}
        </Text>
      </View>
      <RankingAvatar uri={item.avatar} size={32} />
      <View style={styles.identity}>
        <Text numberOfLines={1} style={styles.name}>
          {item.nickname}
        </Text>
        {gapLabel ? (
          <Text numberOfLines={1} style={styles.gap}>
            {gapLabel}
          </Text>
        ) : null}
      </View>
      <View style={styles.metric}>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
          style={styles.value}
        >
          {board === "ORDER_RECEIVE" ? (
            <>
              {Math.round(item.metricValue)}
              <Text style={styles.unit}>单</Text>
            </>
          ) : (
            formatRankingMetric(item.metricValue, board)
          )}
        </Text>
      </View>
    </>
  );

  if (canViewProfile) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`查看${item.nickname}的主页`}
        onPress={openProfile}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={styles.row}>{content}</View>;
});

const styles = StyleSheet.create({
  row: {
    minHeight: 60,
    paddingHorizontal: 8,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
  },
  rankColumn: { width: 24, alignItems: "center", flexShrink: 0 },
  rank: {
    color: "#979799",
    fontSize: 16,
    lineHeight: 20,
    textAlign: "center",
    ...getDDinProStyle(600),
  },
  identity: {
    flex: 1,
    minWidth: 0,
    gap: 2,
    justifyContent: "center",
  },
  name: {
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    lineHeight: 18,
    color: "#0D0D0F",
    fontWeight: "400",
  },
  gap: {
    fontFamily: SYSTEM_FONT,
    fontSize: 11,
    lineHeight: 16,
    color: "#979799",
  },
  metric: {
    width: 64,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  value: {
    fontSize: 16,
    lineHeight: 20,
    color: "#0D0D0F",
    textAlign: "right",
    ...getDDinProStyle(600),
  },
  unit: {
    fontSize: 10,
    lineHeight: 14,
    ...getDDinProStyle(600),
  },
  pressed: { opacity: 0.65 },
});
