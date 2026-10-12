import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomSheet } from "@/shared/ui/BottomSheet";
import { colors } from "@/shared/theme/tokens";
import { DOUYIN_SANS } from "@/shared/theme/typography";
import type { RankingBoard, RankingPeriod } from "../api/ranking.types";
import { getRankingRulesTitle } from "../ranking.config";
import { RANKING_RULES } from "../ranking.rules";

type Props = { visible: boolean; board: RankingBoard; period: RankingPeriod; onClose: () => void };

export function RankingRulesSheet({ visible, board, period, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  return (
    <BottomSheet visible={visible} onClose={onClose} contentStyle={[styles.sheet, { maxHeight: height * 0.82, paddingBottom: Math.max(insets.bottom, 16) }]}>
      <View style={styles.handle} />
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>{getRankingRulesTitle(board, period)}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="关闭榜单规则" onPress={onClose} style={styles.close}>
          <Text style={styles.closeLabel}>×</Text>
        </Pressable>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {RANKING_RULES[board].map((section, sectionIndex) => (
          <View key={sectionIndex} style={styles.section}>
            {section.title ? <Text style={styles.sectionTitle}>{section.title}</Text> : null}
            {section.items.map((item, index) => (
              <View style={styles.rule} key={index}>
                <Text style={styles.number}>{index + 1}.</Text>
                <Text style={styles.ruleText}>{item}</Text>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
      <Pressable accessibilityRole="button" onPress={onClose} style={({ pressed }) => [styles.confirm, pressed && styles.pressed]}>
        <Text style={styles.confirmLabel}>我知道了</Text>
      </Pressable>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20 },
  handle: { width: 32, height: 4, borderRadius: 2, backgroundColor: "#E5E5E9", marginTop: 10, alignSelf: "center" },
  header: { flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 6, paddingBottom: 6 },
  title: { flex: 1, fontFamily: DOUYIN_SANS, fontSize: 17, fontWeight: "600", color: colors.text },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  closeLabel: { fontSize: 28, color: colors.textMuted },
  scroll: { flexShrink: 1 },
  content: { paddingTop: 8, paddingBottom: 20, gap: 20 },
  section: { gap: 10 },
  sectionTitle: { fontFamily: DOUYIN_SANS, fontSize: 14, fontWeight: "600", color: colors.text },
  rule: { flexDirection: "row", gap: 8 },
  number: { fontSize: 12, lineHeight: 22, color: colors.textMuted, width: 18 },
  ruleText: { flex: 1, fontFamily: DOUYIN_SANS, fontSize: 12, lineHeight: 22, color: colors.textSecondary },
  confirm: { minHeight: 46, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: colors.brand, marginTop: 8 },
  confirmLabel: { fontFamily: DOUYIN_SANS, fontSize: 14, fontWeight: "500", color: "#FFF" },
  pressed: { opacity: 0.75 },
});
