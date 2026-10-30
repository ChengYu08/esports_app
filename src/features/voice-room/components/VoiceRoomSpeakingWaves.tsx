import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

type SpeakingWaveProps = {
  size: number;
  maxOpacity: number;
  delay?: number;
  active: boolean;
};

/** 单层声波圆环：说话时呼吸式放大 + 淡出，对齐 Figma Ellipse 33795/33796 */
function SpeakingWave({ size, maxOpacity, delay = 0, active }: SpeakingWaveProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!active) {
      progress.value = withTiming(0, { duration: 200 });
      return;
    }
    progress.value = 0;
    const timer = setTimeout(() => {
      progress.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1200, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 0 }),
        ),
        -1,
        false,
      );
    }, delay);
    return () => clearTimeout(timer);
  }, [active, delay, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: maxOpacity * (1 - progress.value),
    transform: [{ scale: 1 + progress.value * 0.18 }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wave,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          marginLeft: -size / 2,
          marginTop: -size / 2,
        },
        animatedStyle,
      ]}
    />
  );
}

/**
 * 说话时头像外圈的声波动效：
 * 内环 60px 白色描边（峰值 40% 透明度），外环 70px（峰值 10%），交错扩散
 */
export function VoiceRoomSpeakingWaves({ active }: { active: boolean }) {
  return (
    <View pointerEvents="none" style={styles.anchor}>
      <SpeakingWave size={60} maxOpacity={0.4} active={active} />
      <SpeakingWave size={70} maxOpacity={0.1} delay={350} active={active} />
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  wave: {
    position: "absolute",
    left: "50%",
    top: "50%",
    borderWidth: 1,
    borderColor: "#FFFFFF",
  },
});
