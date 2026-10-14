import { Image } from "expo-image";
import { ScrollView, StyleSheet, View } from "react-native";
import { Skeleton, SkeletonText } from "@/shared/ui/Skeleton";
import { colors, radius, spacing } from "@/shared/theme/tokens";

const background = require("../../../../assets/mine/figma/profile-bg.png");

type ProfileSkeletonProps = {
  topInset?: number;
  bottomInset?: number;
  isMine?: boolean;
};

/** Matches the profile page hierarchy while its detail request is pending. */
export function ProfileSkeleton({ topInset = 0, bottomInset = 0, isMine = false }: ProfileSkeletonProps) {
  return (
    <View
      accessible
      accessibilityLabel="个人主页加载中"
      accessibilityRole="progressbar"
      accessibilityState={{ busy: true }}
      style={styles.screen}
    >
      <View style={styles.cover}>
        <Image source={background} contentFit="cover" style={StyleSheet.absoluteFill} />
        <View style={styles.coverShade} />
        <View style={[styles.navbar, { paddingTop: topInset }]}>
          <Skeleton width={24} height={24} radius={12} baseColor="rgba(255,255,255,.28)" highlightColor="rgba(255,255,255,.52)" />
          <Skeleton width={24} height={24} radius={12} baseColor="rgba(255,255,255,.28)" highlightColor="rgba(255,255,255,.52)" />
        </View>
        <View style={styles.identity}>
          <Skeleton width={72} height={72} radius={36} baseColor="rgba(255,255,255,.3)" highlightColor="rgba(255,255,255,.56)" />
          <View style={styles.identityCopy}>
            <Skeleton width="48%" height={18} radius={9} baseColor="rgba(255,255,255,.3)" highlightColor="rgba(255,255,255,.56)" />
            <Skeleton width="38%" height={13} radius={7} baseColor="rgba(255,255,255,.22)" highlightColor="rgba(255,255,255,.46)" />
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: (isMine ? 24 : 88) + bottomInset }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.intro}>
          <View style={styles.stats}>
            <Skeleton width={50} height={24} radius={8} />
            <Skeleton width={50} height={24} radius={8} />
          </View>
          <SkeletonText lines={1} lineHeight={14} lastLineWidth="62%" style={styles.signature} />
        </View>
        <View style={styles.tabs}>
          <Skeleton width={36} height={18} radius={9} />
          <Skeleton width={36} height={18} radius={9} />
        </View>
        <View style={styles.body}>
          <View style={styles.gameTags}>
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} width={index === 1 ? 92 : 78} height={32} radius={6} />
            ))}
          </View>
          <Skeleton width={82} height={19} radius={8} style={styles.sectionTitle} />
          <SkeletonText lines={3} lineHeight={13} lastLineWidth="74%" style={styles.description} />
          <ProfileServiceSkeletonList />
        </View>
        {isMine ? <Skeleton width="100%" height={48} radius={8} style={styles.editButton} /> : null}
      </ScrollView>
      {!isMine ? (
        <View style={[styles.actionBar, { paddingBottom: Math.max(bottomInset, 12) }]}>
          <Skeleton width="100%" height={44} radius={8} />
        </View>
      ) : null}
    </View>
  );
}

export function ProfileGameSkeleton({ reviews = false }: { reviews?: boolean }) {
  return reviews ? <ProfileReviewSkeletonList /> : <ProfileServiceSkeletonList />;
}

function ProfileServiceSkeletonList() {
  return (
    <View style={styles.serviceList}>
      {[0, 1, 2].map((index) => (
        <View key={index} style={styles.serviceCard}>
          <View style={styles.serviceCopy}>
            <Skeleton width={index === 1 ? "58%" : "46%"} height={16} radius={8} />
            <Skeleton width="64%" height={12} radius={6} />
          </View>
          <Skeleton width={54} height={30} radius={15} />
        </View>
      ))}
    </View>
  );
}

function ProfileReviewSkeletonList() {
  return (
    <View style={styles.reviewList}>
      {[0, 1, 2].map((index) => (
        <View key={index} style={styles.reviewCard}>
          <Skeleton width={40} height={40} radius={20} />
          <View style={styles.reviewBody}>
            <Skeleton width={index === 1 ? "54%" : "44%"} height={15} radius={8} />
            <SkeletonText lines={2} lineHeight={12} lastLineWidth="78%" gap={6} />
            <Skeleton width="32%" height={10} radius={5} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  cover: { height: 185, overflow: "hidden", backgroundColor: "#617181" },
  coverShade: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(24,35,47,0.52)" },
  navbar: {
    height: 68,
    paddingHorizontal: spacing.xl,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  identity: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  identityCopy: { flex: 1, gap: spacing.sm },
  content: { flexGrow: 1, backgroundColor: colors.surface },
  intro: {
    marginTop: -1,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  stats: { flexDirection: "row", gap: spacing.lg },
  signature: { marginTop: spacing.md },
  tabs: {
    height: 48,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: 28,
    backgroundColor: colors.surface,
  },
  body: { paddingHorizontal: spacing.lg },
  gameTags: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  sectionTitle: { marginTop: 24 },
  description: { marginTop: spacing.md },
  serviceList: { marginTop: spacing.lg, gap: spacing.md },
  serviceCard: {
    minHeight: 64,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: radius.md,
    backgroundColor: "#f7f7f7",
  },
  serviceCopy: { flex: 1, gap: spacing.sm },
  reviewList: { marginTop: spacing.lg, gap: spacing.lg },
  reviewCard: { flexDirection: "row", gap: spacing.md },
  reviewBody: { flex: 1, gap: spacing.sm },
  editButton: { marginHorizontal: spacing.md, marginTop: "auto" },
  actionBar: {
    minHeight: 64,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
