import { CourtAvatar } from "@/features/court/components/CourtAvatar";
import { CourtVoteButton } from "@/features/court/components/CourtVoteButton";
import {
  formatCount,
  formatTime,
  mapCaseStage,
  type CourtCase,
} from "@/features/court/court.api";
import { COURT_COLORS, COURT_FONT_FAMILY } from "@/features/court/court.theme";
import { CachedImage } from "@/shared/ui/CachedImage";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  item: CourtCase;
  onOpen: () => void;
  onVote: (item: CourtCase, side: "PLAINTIFF_WIN" | "DEFENDANT_WIN") => void;
  onFavorite: (item: CourtCase) => void;
  pendingAction: "vote" | "favorite" | null;
};

const versus = require("../../../../assets/court/versus.svg");
const eye = require("../../../../assets/court/eye.svg");
const star = require("../../../../assets/court/star.svg");
const starFilled = require("../../../../assets/court/star-filled.svg");

export function CourtCard({
  item,
  onOpen,
  onVote,
  onFavorite,
  pendingAction,
}: Props) {
  const busy = pendingAction !== null;
  const stage = mapCaseStage(item);
  const voting = item.stage === "VOTING";
  const defeated = !voting && item.result === "DEFENDANT_WIN";
  const hasVoted = Boolean(item.myVoteResult);
  const disabled = !voting || busy || hasVoted;
  const muted = !voting || hasVoted;
  const stageColor = voting
    ? "#0796A3"
    : defeated
      ? COURT_COLORS.defendant
      : COURT_COLORS.plaintiff;

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityLabel="查看案件详情"
        onPress={onOpen}
        style={styles.main}
      >
        <View style={styles.header}>
          <View
            style={[
              styles.stageTag,
              voting && styles.stageVoting,
              defeated && styles.stageDefeated,
            ]}
          >
            <Text style={[styles.stageText, { color: stageColor }]}>
              {stage.level}
            </Text>
            <View
              style={[styles.stageDivider, { backgroundColor: stageColor }]}
            />
            <Text style={[styles.stageText, { color: stageColor }]}>
              {stage.stage}
            </Text>
          </View>
          <Text style={styles.time}>{formatTime(item.createdAt)}</Text>
        </View>
        <View style={styles.matchup}>
          <Party party={item.plaintiff} side="plaintiff" />
          <CachedImage
            source={versus}
            contentFit="contain"
            style={styles.versus}
          />
          <Party party={item.defendant} side="defendant" />
        </View>
        <View>
          <Text numberOfLines={3} style={styles.content}>
            <Text style={styles.contentLabel}>投诉内容</Text>
            {"\u00A0"}
            {item.contentSummary || item.content || "暂无投诉内容"}
          </Text>
          {!!item.evidenceThumbnails?.length && (
            <View style={styles.thumbnails}>
              {item.evidenceThumbnails.slice(0, 5).map((uri, index) => (
                <CachedImage
                  key={`${uri}-${index}`}
                  source={{ uri }}
                  style={styles.thumbnail}
                />
              ))}
            </View>
          )}
        </View>
      </Pressable>
      <View style={styles.voteRow}>
        <CourtVoteButton
          side="plaintiff"
          selected={item.myVoteResult === "PLAINTIFF_WIN"}
          muted={muted}
          disabled={disabled}
          loading={pendingAction === "vote"}
          count={item.voteSummary?.plaintiff ?? 0}
          onPress={() => onVote(item, "PLAINTIFF_WIN")}
        />
        <CourtVoteButton
          side="defendant"
          selected={item.myVoteResult === "DEFENDANT_WIN"}
          muted={muted}
          disabled={disabled}
          loading={pendingAction === "vote"}
          count={item.voteSummary?.defendant ?? 0}
          onPress={() => onVote(item, "DEFENDANT_WIN")}
        />
      </View>
      <View style={styles.footer}>
        <View style={styles.footerItem}>
          <CachedImage source={eye} style={styles.footerIcon} />
          <Text style={styles.footerText}>{formatCount(item.viewCount)}</Text>
        </View>
        <Pressable
          accessibilityLabel={item.favorited ? "取消收藏" : "收藏案件"}
          accessibilityState={{
            disabled: busy,
            busy: pendingAction === "favorite",
          }}
          disabled={busy}
          hitSlop={8}
          onPress={() => onFavorite(item)}
          style={styles.footerItem}
        >
          <CachedImage
            source={item.favorited ? starFilled : star}
            style={styles.footerIcon}
          />
          <Text
            style={[styles.footerText, item.favorited && styles.favoriteActive]}
          >
            {item.favoriteCount
              ? formatCount(item.favoriteCount)
              : item.favorited
                ? "已收藏"
                : "收藏"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function Party({
  party,
  side,
}: {
  party?: CourtCase["plaintiff"];
  side: "plaintiff" | "defendant";
}) {
  return (
    <View style={styles.party}>
      <CourtAvatar uri={party?.avatar} />
      <View style={styles.partyMeta}>
        <Text style={[styles.role, { color: COURT_COLORS[side] }]}>
          {side === "plaintiff" ? "原告" : "被告"}
        </Text>
        <Text numberOfLines={1} style={styles.name}>
          {party?.nickname || "未知用户"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COURT_COLORS.surface,
    borderRadius: 8,
    marginBottom: 12,
    padding: 12,
  },
  main: { gap: 12 },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  stageTag: {
    alignItems: "center",
    backgroundColor: "#E8F4FF",
    borderRadius: 4,
    flexDirection: "row",
    gap: 4,
    height: 18,
    paddingHorizontal: 6,
  },
  stageVoting: { backgroundColor: "#E3F8FA" },
  stageDefeated: { backgroundColor: "#FFE5EB" },
  stageText: {
    fontFamily: COURT_FONT_FAMILY,
    fontSize: 11,
    fontWeight: "400",
    lineHeight: 16,
  },
  stageDivider: { height: 6, width: 0.5 },
  time: {
    color: COURT_COLORS.muted,
    fontFamily: COURT_FONT_FAMILY,
    fontSize: 12,
    lineHeight: 18,
    flexShrink: 1,
    textAlign: "right",
  },
  matchup: {
    alignItems: "center",
    backgroundColor: COURT_COLORS.background,
    borderRadius: 8,
    flexDirection: "row",
    gap: 24,
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  party: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 8,
    minWidth: 0,
  },
  partyMeta: { flex: 1, minWidth: 0 },
  role: {
    fontFamily: COURT_FONT_FAMILY,
    fontSize: 11,
    fontWeight: "400",
    lineHeight: 16,
  },
  name: {
    color: COURT_COLORS.text,
    fontFamily: COURT_FONT_FAMILY,
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 18,
  },
  versus: { height: 20, width: 25.33 },
  content: {
    color: COURT_COLORS.text,
    fontFamily: COURT_FONT_FAMILY,
    fontSize: 12,
    fontWeight: "400",
    lineHeight: 18,
  },
  contentLabel: { color: COURT_COLORS.muted },
  thumbnails: { flexDirection: "row", gap: 5, marginTop: 8 },
  thumbnail: {
    backgroundColor: "#EEEEEE",
    borderRadius: 6,
    height: 48,
    width: 48,
  },
  voteRow: { flexDirection: "row", marginTop: 12 },
  footer: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
  },
  footerItem: { alignItems: "center", flexDirection: "row", gap: 4 },
  footerIcon: { height: 16, width: 16 },
  footerText: {
    color: COURT_COLORS.footer,
    fontFamily: COURT_FONT_FAMILY,
    fontSize: 12,
    fontWeight: "400",
    lineHeight: 18,
  },
  favoriteActive: { color: COURT_COLORS.favorite },
});
