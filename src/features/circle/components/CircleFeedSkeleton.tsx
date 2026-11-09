import { StyleSheet, View } from "react-native";
import { Skeleton } from "@/shared/ui/Skeleton";

// 深色视频流骨架块，避免默认浅灰在黑底上过亮。
const SKELETON_BASE = "#1C1C1F";
const SKELETON_HIGHLIGHT = "#2A2A2E";
/** 与 AppTabBar 一致的内容区高度。 */
const TAB_CONTENT_HEIGHT = 58;

type CircleFeedSkeletonProps = {
  bottomInset: number;
};

/** 盼友圈首屏加载骨架，按暂停态视频卡片布局占位：右侧操作栏 + 底部文案区。 */
export function CircleFeedSkeleton({ bottomInset }: CircleFeedSkeletonProps) {
  const bottomPadding = TAB_CONTENT_HEIGHT + bottomInset + 12;
  return (
    <View
      accessible
      accessibilityLabel="盼友圈加载中"
      accessibilityRole="progressbar"
      pointerEvents="none"
      style={styles.root}
    >
      <View style={[styles.actionBar, { bottom: bottomPadding + 16 }]}>
        <Skeleton
          width={48}
          height={48}
          radius={24}
          baseColor={SKELETON_BASE}
          highlightColor={SKELETON_HIGHLIGHT}
        />
        <View style={styles.actionGroup}>
          <Skeleton
            width={40}
            height={40}
            radius={20}
            baseColor={SKELETON_BASE}
            highlightColor={SKELETON_HIGHLIGHT}
          />
          <Skeleton
            width={28}
            height={12}
            radius={6}
            baseColor={SKELETON_BASE}
            highlightColor={SKELETON_HIGHLIGHT}
          />
        </View>
        <View style={styles.actionGroup}>
          <Skeleton
            width={40}
            height={40}
            radius={20}
            baseColor={SKELETON_BASE}
            highlightColor={SKELETON_HIGHLIGHT}
          />
          <Skeleton
            width={28}
            height={12}
            radius={6}
            baseColor={SKELETON_BASE}
            highlightColor={SKELETON_HIGHLIGHT}
          />
        </View>
      </View>
      <View style={[styles.info, { bottom: bottomPadding }]}>
        <Skeleton
          width={56}
          height={18}
          radius={3}
          baseColor={SKELETON_BASE}
          highlightColor={SKELETON_HIGHLIGHT}
        />
        <Skeleton
          width={120}
          height={24}
          radius={4}
          baseColor={SKELETON_BASE}
          highlightColor={SKELETON_HIGHLIGHT}
        />
        <Skeleton
          width="70%"
          height={22}
          radius={4}
          baseColor={SKELETON_BASE}
          highlightColor={SKELETON_HIGHLIGHT}
        />
        <Skeleton
          width="86%"
          height={22}
          radius={4}
          baseColor={SKELETON_BASE}
          highlightColor={SKELETON_HIGHLIGHT}
        />
        <Skeleton
          width={150}
          height={16}
          radius={4}
          baseColor={SKELETON_BASE}
          highlightColor={SKELETON_HIGHLIGHT}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#000000",
  },
  actionBar: {
    position: "absolute",
    right: 8,
    alignItems: "center",
    gap: 16,
  },
  actionGroup: { alignItems: "center", gap: 4 },
  info: {
    position: "absolute",
    left: 16,
    right: 72,
    gap: 4,
  },
});
