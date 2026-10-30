import { Image } from "expo-image";
import { ScrollView, StyleSheet, View } from "react-native";
import { Skeleton, SkeletonText } from "@/shared/ui/Skeleton";
import { colors, spacing } from "@/shared/theme/tokens";

const bgClubImage = require("../../../../assets/home/club-detail/bg-club.png");

const lightSkeleton = {
  baseColor: "rgba(255,255,255,.28)",
  highlightColor: "rgba(255,255,255,.52)",
} as const;
const lightSkeletonSoft = {
  baseColor: "rgba(255,255,255,.2)",
  highlightColor: "rgba(255,255,255,.42)",
} as const;

type ClubDetailSkeletonProps = {
  topInset?: number;
  bottomInset?: number;
};

/** 俱乐部详情加载骨架：对齐新版「俱乐部主页」布局（背景图 + 信息区 + 页签 + 筛选 + 卡片列表）。 */
export function ClubDetailSkeleton({ topInset = 0, bottomInset = 0 }: ClubDetailSkeletonProps) {
  return (
    <View
      accessible
      accessibilityLabel="俱乐部详情加载中"
      accessibilityRole="progressbar"
      accessibilityState={{ busy: true }}
      style={styles.screen}
    >
      <Image source={bgClubImage} style={styles.background} contentFit="cover" />
      <View style={[styles.header, { paddingTop: topInset }]}>
        <View style={styles.nav}>
          <Skeleton width={24} height={24} radius={12} {...lightSkeleton} />
          <View style={styles.navActions}>
            <Skeleton width={24} height={24} radius={12} {...lightSkeleton} />
            <Skeleton width={24} height={24} radius={12} {...lightSkeleton} />
          </View>
        </View>
        <View style={styles.clubInfo}>
          <Skeleton width={56} height={56} radius={8} {...lightSkeleton} />
          <View style={styles.clubCopy}>
            <Skeleton width="58%" height={28} radius={8} {...lightSkeleton} />
            <Skeleton width="78%" height={18} radius={6} {...lightSkeletonSoft} />
          </View>
        </View>
        <View style={styles.introBlock}>
          <Skeleton width="100%" height={16} radius={6} {...lightSkeletonSoft} />
          <Skeleton width="82%" height={16} radius={6} {...lightSkeletonSoft} />
        </View>
        <View style={styles.gameTabs}>
          <View style={styles.gameTabActive}>
            <Skeleton width={16} height={16} radius={3} baseColor="#e5e6e8" highlightColor="#f5f6f7" />
            <Skeleton width={52} height={14} radius={7} baseColor="#e5e6e8" highlightColor="#f5f6f7" />
          </View>
          <View style={styles.gameTab}>
            <Skeleton width={16} height={16} radius={3} {...lightSkeleton} />
            <Skeleton width={64} height={14} radius={7} {...lightSkeletonSoft} />
          </View>
        </View>
      </View>

      <View style={styles.listPanel}>
        <View style={styles.filterRow}>
          {[0, 1, 2, 3].map((index) => (
            <View key={index} style={styles.filterItem}>
              <Skeleton width={34 + (index % 2) * 10} height={14} radius={7} />
              <Skeleton width={12} height={12} radius={6} baseColor="#e5e6e8" highlightColor="#f5f6f7" />
            </View>
          ))}
        </View>
        <ScrollView
          contentContainerStyle={[styles.list, { paddingBottom: 92 + bottomInset }]}
          showsVerticalScrollIndicator={false}
        >
          <ClubDetailMemberSkeletonList />
        </ScrollView>
      </View>
      <View style={[styles.bottomBar, { paddingBottom: Math.max(bottomInset, 8) }]}>
        <Skeleton width={104} height={42} radius={8} />
        <Skeleton width="55%" height={42} radius={8} baseColor="#FFD3DB" highlightColor="#FFE9EC" />
      </View>
    </View>
  );
}

export function ClubDetailMemberSkeletonList() {
  return (
    <View accessible={false} style={styles.memberList}>
      {[0, 1, 2, 3, 4].map((index) => (
        <View key={index} style={styles.memberCard}>
          <Skeleton width={100} height={100} radius={8} />
          <View style={styles.memberBody}>
            <Skeleton width={index % 2 === 0 ? "48%" : "58%"} height={18} radius={8} />
            <SkeletonText lines={2} lineHeight={14} lastLineWidth="76%" gap={6} />
            <Skeleton width="36%" height={20} radius={6} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  background: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    width: "100%",
    height: "60%",
  },
  header: { width: "100%" },
  nav: {
    height: 44,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  navActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  clubInfo: {
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  clubCopy: { flex: 1, gap: spacing.sm },
  introBlock: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  gameTabs: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  gameTabActive: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  gameTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
  },
  listPanel: {
    flex: 1,
    backgroundColor: colors.surface,
    borderTopRightRadius: 12,
    paddingTop: spacing.xs,
  },
  filterRow: {
    height: 42,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
  },
  filterItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  list: { flexGrow: 1, paddingTop: spacing.xs },
  memberList: { gap: 0 },
  memberCard: {
    minHeight: 132,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.lg,
  },
  memberBody: { flex: 1, justifyContent: "space-between", paddingTop: 2 },
  bottomBar: {
    minHeight: 66,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
  },
});
