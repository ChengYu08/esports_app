import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { CourtCase } from "@/features/court/court.api";
import { buildCourtProcessTimeline, COURT_TRIAL_LEVELS, type CourtTrialLevel } from "@/features/court/court-process-timeline";
import { COURT_FONT_FAMILY } from "@/features/court/court.theme";
import { CachedImage } from "@/shared/ui/CachedImage";

const LEVEL_LABELS = { FIRST: "一审", SECOND: "二审", THIRD: "三审" };

export function CourtProcessTimeline({ item }: { item: CourtCase }) {
  const currentLevel = item.level || "FIRST";
  const [selectedLevel, setSelectedLevel] = useState<CourtTrialLevel>(currentLevel);
  const levels = COURT_TRIAL_LEVELS.slice(0, COURT_TRIAL_LEVELS.indexOf(currentLevel) + 1);
  // 移动端流程从下往上推进，展示顺序与 Web 相反。
  const steps = buildCourtProcessTimeline({
    level: selectedLevel,
    currentLevel,
    stageCode: item.stage,
    resultCode: item.result,
    timeline: item.timeline,
    trialResults: item.trialResults,
    evidenceDeadline: item.evidenceDeadline,
    voteDeadline: item.voteDeadline,
    createdAt: item.createdAt,
    plaintiffName: item.plaintiff?.nickname,
    defendantName: item.defendant?.nickname,
  }).reverse();

  return (
    <View style={styles.section}>
      {levels.length > 1 && (
        <View accessibilityRole="tablist" style={styles.tabs}>
          {levels.map((level) => (
            <Pressable key={level} accessibilityRole="tab" accessibilityState={{ selected: selectedLevel === level }} onPress={() => setSelectedLevel(level)} style={[styles.tab, selectedLevel === level && styles.tabSelected]}>
              <Text style={[styles.tabText, selectedLevel === level && styles.activeText]}>{LEVEL_LABELS[level]}</Text>
            </Pressable>
          ))}
        </View>
      )}
      {steps.map((step, index) => (
        <View key={step.key} style={styles.row}>
          <View style={styles.rail}>
            {step.status === "done" ? (
              <CachedImage source={require("../../../../assets/court/process-done.png")} style={styles.doneIcon} contentFit="contain" />
            ) : (
              <View style={[styles.dot, step.status === "current" && styles.currentDot]} />
            )}
            {index < steps.length - 1 && <View style={[styles.line, steps[index + 1]?.status === "done" && styles.doneLine, steps[index + 1]?.status === "current" && styles.currentLine]} />}
          </View>
          <View style={[styles.body, index === steps.length - 1 && styles.lastBody]}>
            <View style={styles.titleRow}>
              <Text style={[styles.title, step.status === "current" && styles.activeText, step.status === "pending" && styles.pendingText]}>{step.title}</Text>
              {step.status === "current" && <Text style={styles.progress}>进行中</Text>}
            </View>
            <Text style={[styles.description, step.status === "pending" && styles.pendingText]}>{step.desc}</Text>
            {!!step.time && <Text style={[styles.time, step.deadlineHighlight && styles.activeText]}>{step.time.replace("T", " ")}</Text>}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { backgroundColor: "#fff", padding: 16 },
  tabs: { flexDirection: "row", gap: 8, marginBottom: 16 },
  tab: { minHeight: 32, paddingHorizontal: 12, justifyContent: "center", borderRadius: 4, borderWidth: 0.5, borderColor: "#E5E5E5" },
  tabSelected: { borderColor: "#477BFE", backgroundColor: "#F0F5FF" },
  tabText: { fontFamily: COURT_FONT_FAMILY, fontSize: 12, lineHeight: 18, color: "#656566" },
  row: { flexDirection: "row", gap: 10 },
  rail: { width: 16, alignItems: "center", paddingTop: 3 },
  dot: { width: 16, height: 16, borderRadius: 8, backgroundColor: "#CACACC" },
  currentDot: { backgroundColor: "#477BFE", boxShadow: "0px 0px 0px 3px rgba(71,123,254,0.22)" },
  doneIcon: { width: 16, height: 16 },
  line: { width: 1, flex: 1, minHeight: 28, marginVertical: 4, backgroundColor: "#E5E5E5" },
  doneLine: { backgroundColor: "rgba(52,199,89,0.45)" },
  currentLine: { backgroundColor: "rgba(71,123,254,0.35)" },
  body: { flex: 1, minWidth: 0, paddingBottom: 14 },
  lastBody: { paddingBottom: 0 },
  titleRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
  title: { fontFamily: COURT_FONT_FAMILY, fontSize: 13, fontWeight: "600", lineHeight: 20, color: "#0D0D0F" },
  activeText: { color: "#477BFE" },
  pendingText: { color: "#979799" },
  progress: { fontFamily: COURT_FONT_FAMILY, fontSize: 10, lineHeight: 14, color: "#477BFE", borderColor: "#477BFE", borderWidth: 0.5, borderRadius: 3, paddingHorizontal: 4 },
  description: { fontFamily: COURT_FONT_FAMILY, fontSize: 12, lineHeight: 18, color: "#656566", marginVertical: 4 },
  time: { fontFamily: COURT_FONT_FAMILY, fontSize: 12, lineHeight: 18, color: "#979799" },
});
