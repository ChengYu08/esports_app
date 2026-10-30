import { useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";

const PARTICLE_COUNT = 18;
const PARTICLE_COLORS = ["#FFC700", "#FE1F4C", "#FFFFFF", "#5CE1E6"] as const;
/** 中心原点往外抛射的最大半径 */
const PARTICLE_MAX_RADIUS = 160;
const PARTICLE_LIFETIME_MS = 900;

type Particle = {
  angle: number;
  radius: number;
  size: number;
  color: string;
};

/** 在动画模块外生成粒子参数，避免 React 渲染时随机数不稳定 */
function buildParticles(): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => {
    const color = PARTICLE_COLORS[i % PARTICLE_COLORS.length];
    return {
      angle: (i / PARTICLE_COUNT) * Math.PI * 2 + Math.random() * 0.4,
      radius: PARTICLE_MAX_RADIUS * (0.55 + Math.random() * 0.45),
      size: 4 + Math.random() * 4,
      color,
    };
  });
}

function CelebrationParticle({
  particle,
  progress,
}: {
  particle: Particle;
  progress: SharedValue<number>;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const dist = particle.radius * progress.value;
    return {
      opacity: interpolate(progress.value, [0, 0.15, 1], [0, 1, 0]),
      transform: [
        { translateX: Math.cos(particle.angle) * dist },
        { translateY: Math.sin(particle.angle) * dist - progress.value * 30 },
        {
          scale: interpolate(progress.value, [0, 0.2, 1], [0.3, 1.1, 0.4]),
        },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.particle,
        {
          backgroundColor: particle.color,
          width: particle.size,
          height: particle.size,
          borderRadius: particle.size / 2,
        },
        animatedStyle,
      ]}
    />
  );
}

type MatchCelebrationOverlayProps = {
  centeredOn: { x: number; y: number };
};

/**
 * 匹配成功 / 首位候选人出现时的庆祝 overlay。
 * 短暂播一段 logo 光晕 + 粒子散射，然后由调用方 setState 移除。
 */
export function MatchCelebrationOverlay({
  centeredOn,
}: MatchCelebrationOverlayProps) {
  const particles = buildParticles();
  const haloProgress = useSharedValue(0);
  const logoScale = useSharedValue(1);
  const particleProgress = useSharedValue(0);

  useEffect(() => {
    haloProgress.value = withTiming(1, {
      duration: 680,
      easing: Easing.out(Easing.quad),
    });
    logoScale.value = withSequence(
      withTiming(1.25, { duration: 180, easing: Easing.out(Easing.quad) }),
      withSpring(1, { damping: 10, stiffness: 220 }),
    );
    particleProgress.value = withTiming(1, {
      duration: PARTICLE_LIFETIME_MS,
      easing: Easing.out(Easing.quad),
    });
  }, [haloProgress, logoScale, particleProgress]);

  const haloStyle = useAnimatedStyle(() => ({
    opacity: interpolate(haloProgress.value, [0, 0.2, 1], [0, 0.85, 0]),
    transform: [
      { scale: interpolate(haloProgress.value, [0, 1], [0.4, 2.4]) },
    ],
  }));

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.root, { left: centeredOn.x, top: centeredOn.y }]}
    >
      <Animated.View style={[styles.halo, haloStyle]}>
        <Svg width={140} height={140}>
          <Circle
            cx={70}
            cy={70}
            r={66}
            stroke="#FFC700"
            strokeWidth={2.5}
            strokeOpacity={0.9}
            fill="rgba(255, 199, 0, 0.12)"
          />
        </Svg>
      </Animated.View>

      <Animated.View style={[styles.logoScaleWrap, logoStyle]} />

      {particles.map((particle, index) => (
        <CelebrationParticle
          key={index}
          particle={particle}
          progress={particleProgress}
        />
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    width: 0,
    height: 0,
    alignItems: "center",
    justifyContent: "center",
    // 让叠加层落在导航栏 / 列表之上
    zIndex: 10,
    elevation: 10,
  },
  halo: {
    position: "absolute",
    width: 140,
    height: 140,
    left: -70,
    top: -70,
  },
  logoScaleWrap: {
    position: "absolute",
    width: 0,
    height: 0,
  },
  particle: {
    position: "absolute",
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FFC700",
    left: -3,
    top: -3,
  },
});
