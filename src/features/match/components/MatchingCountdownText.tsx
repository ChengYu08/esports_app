import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { DOUYIN_SANS } from "@/shared/theme/typography";

/** 剩余 ≤ URGENT_SECONDS 时数字每秒心跳一次提示用户注意 */
const URGENT_SECONDS = 10;

type MatchingCountdownTextProps = {
  countdownText: string;
  /** 剩余秒数，用于驱动紧迫感动效；不传则无动效 */
  seconds?: number;
};

export function MatchingCountdownText({
  countdownText,
  seconds,
}: MatchingCountdownTextProps) {
  const reducedMotion = useReducedMotion();
  const pulse = useSharedValue(0);
  const urgent = typeof seconds === "number" && seconds > 0 && seconds <= URGENT_SECONDS;

  useEffect(() => {
    if (!urgent || reducedMotion) {
      pulse.value = 0;
      return;
    }
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 240, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 760, easing: Easing.in(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [pulse, reducedMotion, urgent]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.14 }],
  }));

  return (
    <View style={styles.row}>
      <Text style={styles.muted}>派单倒计时</Text>
      <Animated.Text
        style={[styles.accent, urgent && styles.accentUrgent, animatedStyle]}
      >
        {countdownText}
      </Animated.Text>
      <Text style={styles.muted}>，到期自动取消</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  muted: {
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    lineHeight: 18,
    color: "rgba(255,255,255,0.6)",
  },
  accent: {
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    lineHeight: 18,
    color: "#FE4267",
  },
  accentUrgent: {
    color: "#FF3B30",
    fontWeight: "600",
  },
});
