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

export function VoiceWaveform({ playing, compact = false }: { playing: boolean; compact?: boolean }) {
  return (
    <View style={[styles.wave, compact && styles.compactWave]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {BAR_HEIGHTS.map((height, index) => (
        <WaveBar
          key={height}
          delay={index * 120}
          height={compact ? Math.round(height * 0.75) : height}
          playing={playing}
        />
      ))}
    </View>
  );
}

function WaveBar({ delay, height, playing }: { delay: number; height: number; playing: boolean }) {
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

  return <Animated.View style={[styles.bar, { height }, animatedStyle]} />;
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
    width: 2,
    borderRadius: 1,
    backgroundColor: "#fff",
    transformOrigin: "center",
  },
});
