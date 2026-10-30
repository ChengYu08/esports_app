import { Image } from "expo-image";
import { Pressable, StyleSheet, View } from "react-native";
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Rect,
  Stop,
} from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Easing,
  FadeIn,
  FadeInUp,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useEffect, useState } from "react";

import type { MatchGame } from "@/features/match/api/match.types";
import { MatchingCountdownText } from "@/features/match/components/MatchingCountdownText";
import { DOUYIN_SANS } from "@/shared/theme/typography";

const FOOTER_CONTENT_BOTTOM = 22;

/** Figma 532:105048~055 导出的小图（@2x，单张约 3~24KB） */
const avatar1 = require("../../../../assets/images/radar-avatar-1.png");
const avatar2 = require("../../../../assets/images/radar-avatar-2.png");
const avatar3 = require("../../../../assets/images/radar-avatar-3.png");
const avatar4 = require("../../../../assets/images/radar-avatar-4.png");
const avatar5 = require("../../../../assets/images/radar-avatar-5.png");
const avatar6 = require("../../../../assets/images/radar-avatar-6.png");
const avatar7 = require("../../../../assets/images/radar-avatar-7.png");
const avatar8 = require("../../../../assets/images/radar-avatar-8.png");

/** Figma 532:105041 雷达尺寸 */
const RADAR_SIZE = 279;
/** Figma Ellipse 33791 / 33790：stroke 16，路径相对外框内缩 8 */
const RING_STROKE = 16;
const RING_PATH_INSET = RING_STROKE / 2;

/** Figma 532:105047 头像位：坐标 + 导出图 */
const DECOR_SLOTS = [
  { left: 64, top: 13, size: 56, source: avatar1, bordered: true },
  { left: 220, top: 77, size: 58, source: avatar2 },
  { left: 182, top: 26, size: 24, source: avatar3 },
  { left: 182, top: 198, size: 29, source: avatar4 },
  { left: 249, top: 170, size: 20, source: avatar5 },
  { left: 18, top: 204, size: 20, source: avatar6 },
  { left: 2, top: 102, size: 40, source: avatar7 },
  { left: 64, top: 213, size: 52, source: avatar8 },
] as const;

/** 扩散圈从中心 logo 外圈扩到雷达外缘的缩放起点（logo 直径 76） */
const RIPPLE_SCALE_START = 76 / RADAR_SIZE;
/** 扫描光束角度谐波分段的水平镜像宽度：在 3200ms 里转完 360° */
const SWEEP_PERIOD_MS = 3200;
/** 头像呼吸浮动幅度（px） */
const AVATAR_FLOAT_Y = 2.5;

type MatchingWaitingViewProps = {
  countdownText: string;
  countdownSec: number;
  /** 发布页选中的游戏；无 icon 时显示名称首字 */
  game?: Pick<MatchGame, "name" | "iconUrl"> | null;
  onCancel?: () => void;
};

/** Figma 三圆环：外/中描边圆 + 内填充圆，不用图片 */
function RadarRings() {
  const center = RADAR_SIZE / 2;
  const outerR = center - RING_PATH_INSET;
  const midR = 211 / 2 - RING_PATH_INSET;
  /** Ellipse 33789：left 68 / top 67 / size 144 */
  const innerCx = 68 + 72;
  const innerCy = 67 + 72;

  return (
    <Svg
      width={RADAR_SIZE}
      height={RADAR_SIZE}
      style={styles.ringsSvg}
      pointerEvents="none"
    >
      <Circle
        cx={center}
        cy={center}
        r={outerR}
        stroke="#FFFFFF"
        strokeWidth={RING_STROKE}
        strokeOpacity={0.01}
        fill="none"
      />
      <Circle
        cx={center}
        cy={center}
        r={midR}
        stroke="#FFFFFF"
        strokeWidth={RING_STROKE}
        strokeOpacity={0.03}
        fill="none"
      />
      <Circle cx={innerCx} cy={innerCy} r={72} fill="#FFFFFF" fillOpacity={0.05} />
    </Svg>
  );
}

/** 中心向外扩散的雷达波，错相位三层 */
function RadarRipple({ delay }: { delay: number }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, {
          duration: 2400,
          easing: Easing.out(Easing.quad),
        }),
        -1,
        false,
      ),
    );
    return () => {
      progress.value = 0;
    };
  }, [delay, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.15, 1], [0, 0.5, 0]),
    transform: [
      {
        scale: interpolate(progress.value, [0, 1], [RIPPLE_SCALE_START, 1]),
      },
    ],
  }));

  return <Animated.View style={[styles.ripple, animatedStyle]} pointerEvents="none" />;
}

/** 360° 旋转的雷达扫描光束（一个从中心出发的楔形渐变） */
function RadarSweep() {
  const rotation = useSharedValue(0);
  const center = RADAR_SIZE / 2;
  /** 楔形尖端超出画布，靠雷达容器 overflow:hidden 裁剪 */
  const wedgeWidth = RADAR_SIZE * 2;

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: SWEEP_PERIOD_MS, easing: Easing.linear }),
      -1,
      false,
    );
  }, [rotation]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotateZ: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View
      style={[styles.sweepWrap, animatedStyle]}
      pointerEvents="none"
    >
      <Svg width={RADAR_SIZE} height={RADAR_SIZE}>
        <Defs>
          <LinearGradient id="sweep" x1="0" y1="0.5" x2="1" y2="0.5">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
            <Stop offset="0.62" stopColor="#FFFFFF" stopOpacity="0.06" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0.3" />
          </LinearGradient>
        </Defs>
        <G rotation="18" origin={`${center}, ${center}`}>
          <Rect
            x={center}
            y={center - wedgeWidth / 2}
            width={RADAR_SIZE}
            height={wedgeWidth}
            fill="url(#sweep)"
          />
        </G>
      </Svg>
    </Animated.View>
  );
}

/** 单个装饰头像：错峰入场 + 空闲时上下浮动 */
function DecorAvatar({
  slot,
  index,
}: {
  slot: (typeof DECOR_SLOTS)[number];
  index: number;
}) {
  const floatOffset = useSharedValue(0);

  useEffect(() => {
    floatOffset.value = withDelay(
      1000 + index * 180,
      withRepeat(
        withSequence(
          withTiming(-AVATAR_FLOAT_Y, {
            duration: 1100,
            easing: Easing.inOut(Easing.ease),
          }),
          withTiming(AVATAR_FLOAT_Y, {
            duration: 1100,
            easing: Easing.inOut(Easing.ease),
          }),
        ),
        -1,
        true,
      ),
    );
  }, [floatOffset, index]);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatOffset.value }],
  }));

  return (
    <Animated.View
      entering={FadeInUp.delay(120 + index * 90)
        .duration(420)
        .springify()
        .damping(15)}
    >
      <Animated.View style={floatStyle}>
        <Image
          source={slot.source}
          style={[
            styles.decorAvatar,
            "bordered" in slot && slot.bordered ? styles.decorAvatarBorder : null,
            {
              left: slot.left,
              top: slot.top,
              width: slot.size,
              height: slot.size,
              borderRadius: slot.size / 2,
            },
          ]}
          contentFit="cover"
        />
      </Animated.View>
    </Animated.View>
  );
}

/** 「大神抢单中...」后的三个省略点依次闪动 */
function AnimatedEllipsis() {
  return (
    <View style={styles.ellipsisRow} pointerEvents="none">
      {[0, 1, 2].map((i) => (
        <EllipsisDot key={i} delay={i * 160} />
      ))}
    </View>
  );
}

function EllipsisDot({ delay }: { delay: number }) {
  const opacity = useSharedValue(0.25);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 320, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.25, { duration: 500, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      ),
    );
  }, [delay, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.Text style={[styles.ellipsisDot, animatedStyle]}>·</Animated.Text>
  );
}

const TITLE_LINES = [
  "大神抢单中",
  "正在为你寻找最稳的车",
  "匹配靠技术，不是运气",
] as const;

/** 标题循环文案 + 跳动的省略号 */
function AnimatedTitle() {
  return (
    <View style={styles.titleRow}>
      <RollingTitleText lines={TITLE_LINES} />
      <AnimatedEllipsis />
    </View>
  );
}

/** 标题在多条文案间轮播，每隔 ~4s 换一条 */
function RollingTitleText({ lines }: { lines: readonly string[] }) {
  const reducedMotion = useReducedMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reducedMotion) return;
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % lines.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [lines.length, reducedMotion]);

  return (
    <Animated.Text
      key={index}
      entering={FadeIn.duration(260)}
      style={styles.title}
    >
      {lines[index]}
    </Animated.Text>
  );
}

export function MatchingWaitingView({
  countdownText,
  countdownSec,
  game,
  onCancel,
}: MatchingWaitingViewProps) {
  const insets = useSafeAreaInsets();
  const initial = (game?.name?.trim().charAt(0) || "?").toUpperCase();

  return (
    <View style={styles.root}>
      <View style={styles.main}>
        <View style={styles.textBlock}>
          <AnimatedTitle />
          <MatchingCountdownText
            countdownText={countdownText}
            seconds={countdownSec}
          />
        </View>

        <View style={styles.radar}>
          <RadarRings />
          <RadarSweep />
          <RadarRipple delay={0} />
          <RadarRipple delay={800} />
          <RadarRipple delay={1600} />

          {DECOR_SLOTS.map((item, index) => (
            <DecorAvatar key={`avatar-${index}`} slot={item} index={index} />
          ))}

          <View style={styles.logoWrap}>
            {game?.iconUrl ? (
              <Image
                source={{ uri: game.iconUrl }}
                style={styles.logo}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.logo, styles.logoPlaceholder]}>
                <Animated.Text style={styles.logoInitial}>{initial}</Animated.Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {onCancel ? (
        <View
          style={[
            styles.footer,
            { paddingBottom: insets.bottom + FOOTER_CONTENT_BOTTOM },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="取消匹配"
            onPress={onCancel}
            style={({ pressed }) => [
              styles.cancelButton,
              pressed && styles.pressed,
            ]}
          >
            <Animated.Text style={styles.cancelText}>取消匹配</Animated.Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  main: {
    flex: 1,
    alignItems: "center",
    paddingTop: 96,
    gap: 32,
  },
  textBlock: {
    width: "100%",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  title: {
    fontFamily: DOUYIN_SANS,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "600",
    color: "#FFFFFF",
    textAlign: "center",
  },
  ellipsisRow: {
    flexDirection: "row",
    marginLeft: 6,
  },
  ellipsisDot: {
    fontFamily: DOUYIN_SANS,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "600",
    color: "#FFFFFF",
    width: 10,
    textAlign: "center",
  },
  radar: {
    width: RADAR_SIZE,
    height: RADAR_SIZE,
    position: "relative",
    overflow: "hidden",
    borderRadius: RADAR_SIZE / 2,
  },
  ringsSvg: {
    ...StyleSheet.absoluteFill,
  },
  sweepWrap: {
    ...StyleSheet.absoluteFill,
  },
  ripple: {
    position: "absolute",
    width: RADAR_SIZE,
    height: RADAR_SIZE,
    borderRadius: RADAR_SIZE / 2,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.55)",
  },
  decorAvatar: {
    position: "absolute",
    overflow: "hidden",
  },
  decorAvatarBorder: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.6)",
  },
  logoWrap: {
    position: "absolute",
    left: 102,
    top: 101,
    width: 76,
    height: 76,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: 74.5,
    height: 74.5,
    borderRadius: 37.25,
  },
  logoPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  logoInitial: {
    fontFamily: DOUYIN_SANS,
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  footer: {
    paddingTop: 8,
    paddingHorizontal: 16,
  },
  cancelButton: {
    height: 42,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  cancelText: {
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "500",
    color: "#FFFFFF",
  },
  pressed: {
    opacity: 0.85,
  },
});
