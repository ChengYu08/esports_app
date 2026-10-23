import { CourtAvatar } from "@/features/court/components/CourtAvatar";
import type { CourtCase } from "@/features/court/court.api";
import { COURT_COLORS, COURT_FONT_FAMILY } from "@/features/court/court.theme";
import { StyleSheet, Text, View } from "react-native";

type CourtJudgmentResultProps = {
  item: Pick<CourtCase, "result" | "plaintiff" | "defendant" | "handleResult">;
};

export function CourtJudgmentResult({ item }: CourtJudgmentResultProps) {
  const { result, handleResult } = item;

  if (
    result !== "PLAINTIFF_WIN" &&
    result !== "DEFENDANT_WIN" &&
    result !== "INVALID"
  ) {
    return null;
  }

  const plaintiffWon = result === "PLAINTIFF_WIN";
  const winner = plaintiffWon ? item.plaintiff : item.defendant;
  const winnerRole = plaintiffWon ? "原告" : "被告";
  const description =
    handleResult?.trim() ||
    (result === "INVALID"
      ? "本次裁决无效，具体处理以平台公示为准。"
      : "平台会根据诉求作出相应处理，后续将在此帖发布公示。");

  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.title}>判决结果</Text>
      {result === "INVALID" ? (
        <Text style={styles.resultText}>本次裁决无效</Text>
      ) : (
        <View style={styles.resultRow}>
          <Text style={styles.resultText}>本次裁决结果为{winnerRole}</Text>
          <View style={styles.winner}>
            <CourtAvatar uri={winner?.avatar} size={18} />
            <Text numberOfLines={1} style={styles.winnerName}>
              {winner?.nickname?.trim() || "未知用户"}
            </Text>
          </View>
          <Text style={styles.resultText}>获胜</Text>
        </View>
      )}
      <Text style={styles.description}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: COURT_COLORS.surface,
    gap: 8,
    marginTop: 8,
    padding: 16,
  },
  title: {
    color: COURT_COLORS.text,
    fontFamily: COURT_FONT_FAMILY,
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 24,
  },
  resultRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  resultText: {
    color: COURT_COLORS.text,
    fontFamily: COURT_FONT_FAMILY,
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 22,
  },
  winner: {
    alignItems: "center",
    backgroundColor: COURT_COLORS.background,
    borderRadius: 12,
    flexDirection: "row",
    gap: 4,
    maxWidth: "45%",
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  winnerName: {
    color: COURT_COLORS.text,
    flexShrink: 1,
    fontFamily: COURT_FONT_FAMILY,
    fontSize: 12,
    lineHeight: 18,
  },
  description: {
    color: COURT_COLORS.footer,
    fontFamily: COURT_FONT_FAMILY,
    fontSize: 14,
    lineHeight: 22,
  },
});
