import { ScrollView, StyleSheet, View } from "react-native";
import { Skeleton, SkeletonText } from "@/shared/ui/Skeleton";
import { colors, radius, spacing } from "@/shared/theme/tokens";

type HomeSkeletonProps = {
  bottomPadding?: number;
};

/** 首页品类、游戏和俱乐部加载时保持布局稳定。 */
export function HomeSkeleton({ bottomPadding = 0 }: HomeSkeletonProps) {
  return (
    <ScrollView
      accessibilityLabel="首页内容加载中"
      accessibilityRole="progressbar"
      accessibilityState={{ busy: true }}
      contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.categories}>
        {[0, 1, 2].map((index) => (
          <View key={index} style={styles.category}>
            <Skeleton width="100%" height={56} radius={radius.md} />
          </View>
        ))}
      </View>
      <View style={styles.gameTabs}>
        {[72, 82, 72, 82].map((width, index) => (
          <View key={index} style={styles.gameTab}>
            <Skeleton width={16} height={16} radius={4} />
            <Skeleton width={width} height={14} radius={7} />
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Skeleton width={96} height={20} radius={6} />
      </View>

      <View style={styles.clubs}>
        {[0, 1, 2, 3, 4].map((index) => (
          <View key={index} style={styles.club}>
            <Skeleton width={84} height={84} radius={radius.md} />
            <View style={styles.clubBody}>
              <Skeleton width={index % 2 === 0 ? "54%" : "44%"} height={16} radius={8} />
              <SkeletonText lines={2} lineHeight={12} lastLineWidth="82%" gap={6} />
              <Skeleton width="42%" height={11} radius={6} />
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, backgroundColor: colors.surface },
  categories: { flexDirection: "row", paddingHorizontal: spacing.lg, paddingTop: spacing.xs, paddingBottom: spacing.sm, gap: spacing.sm },
  category: { flex: 1 },
  gameTabs: {
    height: 55,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.md,
    overflow: "hidden",
  },
  gameTab: {
    height: 38,
    paddingHorizontal: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  section: {
    height: 50,
    paddingHorizontal: spacing.lg,
    justifyContent: "center",
  },
  clubs: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  club: { minHeight: 84, flexDirection: "row", gap: spacing.md },
  clubBody: { flex: 1, gap: spacing.sm, paddingTop: 1 },
});
