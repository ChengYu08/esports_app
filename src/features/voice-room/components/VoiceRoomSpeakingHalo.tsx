import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

/** 光晕基础色（品牌紫） */
const HALO_COLOR = "167, 139, 250";

type HaloRingProps = {
  /** 光环起始直径（≈头像直径） */
  baseSize: number;
  /** 扩散增量（直径方向） */
  spread: number;
  /** 起始透明度峰值 */
  maxOpacity: number;
  /** 描边宽度 */
  borderWidth: number;
  /** 相位偏移（0~1），错开多圈光环 */
  phase: number;
  active: boolean;
  /** 一轮扩散时长 */
  duration: number;
};

/**
 * 单圈发散光环：从头像边缘向外扩散并淡出，循环播放。
 * 多圈通过 phase 错开相位，形成连续不断的波纹。
 */
function HaloRing({
  baseSize,
  spread,
  maxOpacity,
  borderWidth,
  phase,
  active,
  duration,
}: HaloRingProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!active) {
      cancelAnimation(progress);
      progress.value = withTiming(0, { duration: 180 });
      return;
    }
    progress.value = phase;
    progress.value = withRepeat(
      withTiming(1 + phase, { duration, easing: Easing.out(Easing.cubic) }),
      -1,
      false,
    );
  }, [active, phase, duration, progress]);

  const animatedStyle = useAnimatedStyle(() => {
    const t = progress.value % 1;
    return {
      opacity: interpolate(t, [0, 0.15, 1], [0, maxOpacity, 0]),
      transform: [{ scale: 1 + (t * spread) / baseSize }],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ring,
        {
          width: baseSize,
          height: baseSize,
          borderRadius: baseSize / 2,
          borderWidth,
          marginLeft: -baseSize / 2,
          marginTop: -baseSize / 2,
        },
        animatedStyle,
      ]}
    />
  );
}

/** 常驻呼吸光晕：贴在头像底下的柔和发光层 */
function BreathingGlow({ size, active }: { size: number; active: boolean }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!active) {
      cancelAnimation(progress);
      progress.value = withTiming(0, { duration: 180 });
      return;
    }
    progress.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [active, progress]);

  const animatedStyle = useAnimatedStyle(() => {
    const scaleValue = interpolate(progress.value, [0, 1], [1, 1.08]);
    const opacityValue = interpolate(progress.value, [0, 1], [0.3, 0.55]);
    return {
      opacity: opacityValue,
      transform: [{ scale: scaleValue }],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.glow,
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
 * 说话时头像周围的光环发散动效：
 * 一层呼吸光晕 + 三圈由内向外的扩散光环（相位错开），
 * 一眼即可识别正在发言的用户。
 */
export function VoiceRoomSpeakingHalo(props: {
  active: boolean;
  avatarSize?: number;
}) {
  const active = props.active;
  const avatarSize = props.avatarSize ?? 48;
  const base = avatarSize + 4;
  return (
    <View pointerEvents="none" style={styles.anchor}>
      <BreathingGlow size={base + 6} active={active} />
      <HaloRing
        baseSize={base}
        spread={26}
        maxOpacity={0.85}
        borderWidth={2}
        phase={0}
        active={active}
        duration={1500}
      />
      <HaloRing
        baseSize={base}
        spread={26}
        maxOpacity={0.55}
        borderWidth={1.5}
        phase={0.34}
        active={active}
        duration={1500}
      />
      <HaloRing
        baseSize={base}
        spread={26}
        maxOpacity={0.3}
        borderWidth={1}
        phase={0.67}
        active={active}
        duration={1500}
      />
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
  ring: {
    position: "absolute",
    left: "50%",
    top: "50%",
    borderColor: `rgba(${HALO_COLOR}, 1)`,
  },
  glow: {
    position: "absolute",
    left: "50%",
    top: "50%",
    backgroundColor: `rgba(${HALO_COLOR}, 0.35)`,
  },
});
