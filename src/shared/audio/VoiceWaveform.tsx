import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  ReduceMotion,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

const BAR_HEIGHTS = [8, 14, 10, 12];

export function VoiceWaveform({
  playing,
  compact = false,
  barOpacity = 1,
}: {
  playing: boolean;
  compact?: boolean;
  barOpacity?: number;
}) {
  if (!playing) {
    // 未播放时波形静止，用普通 View 渲染同样的 4 根柱，避免 reanimated 动画节点常驻
    return (
      <View style={[styles.wave, compact && styles.compactWave]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {BAR_HEIGHTS.map((height) => (
          <View
            key={height}
            style={[
              styles.bar,
              {
                height: compact ? Math.round(height * 0.75) : height,
                opacity: barOpacity,
              },
            ]}
          />
        ))}
      </View>
    );
  }
  return (
    <View style={[styles.wave, compact && styles.compactWave]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {BAR_HEIGHTS.map((height, index) => (
        <WaveBar
          key={height}
          barOpacity={barOpacity}
          delay={index * 120}
          height={compact ? Math.round(height * 0.75) : height}
          playing={playing}
        />
      ))}
    </View>
  );
}

function WaveBar({
  barOpacity,
  delay,
  height,
  playing,
}: {
  barOpacity: number;
  delay: number;
  height: number;
  playing: boolean;
}) {
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(playing && !reducedMotion ? 0.45 : 1);

  useEffect(() => {
    cancelAnimation(scale);
    if (!playing || reducedMotion) {
      scale.set(1);
      return;
    }

    scale.set(
      withSequence(
        withTiming(0.45, { duration: 0 }),
        withDelay(
          delay,
          withRepeat(
            withTiming(1, {
              duration: 360,
              easing: Easing.inOut(Easing.ease),
              reduceMotion: ReduceMotion.System,
            }),
            -1,
            true,
            undefined,
            ReduceMotion.System,
          ),
        ),
      ),
    );

    return () => cancelAnimation(scale);
  }, [delay, playing, reducedMotion, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: scale.get() }],
  }));

  return (
    <Animated.View
      style={[styles.bar, { height, opacity: barOpacity }, animatedStyle]}
    />
  );
}

const styles = StyleSheet.create({
  wave: {
    width: 20,
    height: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2.5,
    flexShrink: 0,
  },
  compactWave: { width: 16, height: 16, gap: 2 },
  bar: {
    width: 1.5,
    borderRadius: 0.75,
    backgroundColor: "#fff",
    transformOrigin: "center",
  },
});
