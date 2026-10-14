import { useEffect } from "react";
import Animated, {
  Easing,
  ReduceMotion,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import {
  StyleSheet,
  View,
  type DimensionValue,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { colors, radius, spacing } from "@/shared/theme/tokens";

export type SkeletonProps = {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  baseColor?: string;
  highlightColor?: string;
  duration?: number;
  animate?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const DEFAULT_RADIUS = radius.md;

/** A shimmer primitive using the app's existing animation dependencies. */
export function Skeleton({
  width = "100%",
  height = 16,
  radius = DEFAULT_RADIUS,
  baseColor = colors.skeleton,
  highlightColor = colors.skeletonHighlight,
  duration = 1100,
  animate = true,
  style,
  testID,
}: SkeletonProps) {
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const containerWidth = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(progress);
    if (!animate || reducedMotion) {
      progress.set(0);
      return;
    }

    progress.set(
      withRepeat(
        withTiming(1, {
          duration,
          easing: Easing.linear,
          reduceMotion: ReduceMotion.System,
        }),
        -1,
        false,
        undefined,
        ReduceMotion.System,
      ),
    );

    return () => cancelAnimation(progress);
  }, [animate, duration, progress, reducedMotion]);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(progress.get(), [0, 1], [-containerWidth.get(), containerWidth.get()]),
      },
    ],
  }));

  const handleLayout = (event: LayoutChangeEvent) => {
    containerWidth.set(event.nativeEvent.layout.width);
  };

  return (
    <View
      accessible={false}
      onLayout={handleLayout}
      style={[styles.root, { width, height, borderRadius: radius, backgroundColor: baseColor }, style]}
      testID={testID}
    >
      {animate && !reducedMotion && (
        <Animated.View style={[styles.shimmer, shimmerStyle]}>
          <LinearGradient
            colors={[baseColor, highlightColor, baseColor]}
            locations={[0, 0.5, 1]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.gradient}
          />
        </Animated.View>
      )}
    </View>
  );
}

/** A text-shaped placeholder with a shorter final line. */
export function SkeletonText({
  lines = 2,
  lineHeight = 12,
  width = "100%",
  lastLineWidth = "68%",
  gap = 6,
  style,
}: {
  lines?: number;
  lineHeight?: number;
  width?: DimensionValue;
  lastLineWidth?: DimensionValue;
  gap?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const count = Math.max(1, Math.floor(lines));

  return (
    <View style={[styles.textGroup, { gap }, style]}>
      {Array.from({ length: count }, (_, index) => (
        <Skeleton
          key={index}
          height={lineHeight}
          width={index === count - 1 ? lastLineWidth : width}
          radius={lineHeight / 2}
        />
      ))}
    </View>
  );
}

export function SkeletonCircle({ size = 48, style, testID }: { size?: number; style?: StyleProp<ViewStyle>; testID?: string }) {
  return <Skeleton testID={testID} height={size} radius={size / 2} style={[{ width: size }, style]} />;
}

/** A ready-to-use list placeholder for FlatList/SectionList empty states. */
export function SkeletonList({
  rows = 3,
  message = "内容加载中",
  style,
  testID,
}: {
  rows?: number;
  message?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const count = Math.max(0, Math.floor(rows));

  return (
    <View accessible accessibilityLabel={message} accessibilityState={{ busy: true }} accessibilityRole="progressbar" style={[styles.list, style]} testID={testID}>
      {Array.from({ length: count }, (_, index) => (
        <View key={index} style={styles.listRow}>
          <SkeletonCircle size={84} />
          <View style={styles.listBody}>
            <Skeleton height={16} width="56%" radius={8} />
            <SkeletonText lines={2} lineHeight={12} lastLineWidth="82%" />
            <Skeleton height={11} width="42%" radius={6} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { overflow: "hidden" },
  shimmer: { position: "absolute", top: 0, bottom: 0, left: 0, width: "60%" },
  gradient: { width: "100%", height: "100%" },
  textGroup: { width: "100%" },
  list: { width: "100%", paddingHorizontal: spacing.lg, gap: spacing.lg },
  listRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  listBody: { flex: 1, gap: spacing.sm, paddingTop: 2 },
});
