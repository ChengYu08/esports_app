import { LinearGradient } from "expo-linear-gradient";
import { ScrollView, StyleSheet, View } from "react-native";
import { Skeleton, SkeletonText } from "@/shared/ui/Skeleton";
import { colors, spacing } from "@/shared/theme/tokens";

type ClubDetailSkeletonProps = {
  topInset?: number;
  bottomInset?: number;
};

/** Mirrors the club detail layout during the initial club request. */
export function ClubDetailSkeleton({ topInset = 0, bottomInset = 0 }: ClubDetailSkeletonProps) {
  return (
    <View
      accessible
      accessibilityLabel="俱乐部详情加载中"
      accessibilityRole="progressbar"
      accessibilityState={{ busy: true }}
      style={styles.screen}
    >
      <LinearGradient
        colors={["#3b6f75", "#2a6681"]}
        end={{ x: 1, y: 0.8 }}
        start={{ x: 0, y: 0 }}
        style={[styles.header, { paddingTop: topInset }]}
      >
        <View style={styles.nav}>
          <Skeleton width={24} height={24} radius={12} baseColor="rgba(255,255,255,.28)" highlightColor="rgba(255,255,255,.52)" />
          <Skeleton width={24} height={24} radius={12} baseColor="rgba(255,255,255,.28)" highlightColor="rgba(255,255,255,.52)" />
        </View>
        <View style={styles.clubInfo}>
          <Skeleton width={40} height={40} radius={6} baseColor="rgba(255,255,255,.28)" highlightColor="rgba(255,255,255,.52)" />
          <View style={styles.clubCopy}>
            <Skeleton width="58%" height={17} radius={8} baseColor="rgba(255,255,255,.28)" highlightColor="rgba(255,255,255,.52)" />
            <Skeleton width="78%" height={12} radius={6} baseColor="rgba(255,255,255,.2)" highlightColor="rgba(255,255,255,.42)" />
          </View>
        </View>
        <View style={styles.gameTabs}>
          {[76, 88, 76].map((width, index) => (
            <View key={index} style={styles.gameTab}>
              <Skeleton width={16} height={16} radius={3} baseColor="rgba(255,255,255,.24)" highlightColor="rgba(255,255,255,.48)" />
              <Skeleton width={width} height={13} radius={7} baseColor="rgba(255,255,255,.24)" highlightColor="rgba(255,255,255,.48)" />
            </View>
          ))}
        </View>
      </LinearGradient>

      <View style={styles.filterRow}>
        {[0, 1, 2, 3].map((index) => (
          <View key={index} style={styles.filterItem}>
            <Skeleton width={34 + (index % 2) * 10} height={13} radius={7} />
            <Skeleton width={10} height={10} radius={5} />
          </View>
        ))}
      </View>
      <ScrollView
        contentContainerStyle={[styles.list, { paddingBottom: 92 + bottomInset }]}
        showsVerticalScrollIndicator={false}
      >
        <ClubDetailMemberSkeletonList />
      </ScrollView>
      <View style={[styles.bottomBar, { paddingBottom: Math.max(bottomInset, 12) }]}>
        <Skeleton width={82} height={38} radius={19} />
      </View>
    </View>
  );
}

export function ClubDetailMemberSkeletonList() {
  return (
    <View accessible={false} style={styles.memberList}>
      {[0, 1, 2, 3, 4].map((index) => (
        <View key={index} style={styles.memberCard}>
          <Skeleton width={56} height={56} radius={28} />
          <View style={styles.memberBody}>
            <Skeleton width={index % 2 === 0 ? "48%" : "58%"} height={16} radius={8} />
            <SkeletonText lines={2} lineHeight={12} lastLineWidth="76%" gap={6} />
            <Skeleton width="36%" height={11} radius={6} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: { width: "100%" },
  nav: {
    height: 44,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  clubInfo: {
    minHeight: 104,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  clubCopy: { flex: 1, gap: spacing.sm },
  gameTabs: {
    height: 40,
    paddingHorizontal: spacing.xs,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
  },
  gameTab: {
    height: 40,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  filterRow: {
    height: 42,
    paddingHorizontal: spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
  },
  filterItem: {
    flex: 1,
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  list: { flexGrow: 1, paddingTop: spacing.lg },
  memberList: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  memberCard: { minHeight: 72, flexDirection: "row", gap: spacing.md },
  memberBody: { flex: 1, gap: spacing.sm, paddingTop: 2 },
  bottomBar: {
    minHeight: 64,
    paddingHorizontal: spacing.lg,
    justifyContent: "center",
    alignItems: "flex-start",
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
