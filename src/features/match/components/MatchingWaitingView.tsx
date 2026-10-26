import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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

type MatchingWaitingViewProps = {
  countdownText: string;
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

export function MatchingWaitingView({
  countdownText,
  game,
  onCancel,
}: MatchingWaitingViewProps) {
  const insets = useSafeAreaInsets();
  const initial = (game?.name?.trim().charAt(0) || "?").toUpperCase();

  return (
    <View style={styles.root}>
      <View style={styles.main}>
        <View style={styles.textBlock}>
          <Text style={styles.title}>大神抢单中...</Text>
          <MatchingCountdownText countdownText={countdownText} />
        </View>

        <View style={styles.radar}>
          <RadarRings />

          {DECOR_SLOTS.map((item, index) => (
            <Image
              key={`avatar-${index}`}
              source={item.source}
              style={[
                styles.decorAvatar,
                "bordered" in item && item.bordered
                  ? styles.decorAvatarBorder
                  : null,
                {
                  left: item.left,
                  top: item.top,
                  width: item.size,
                  height: item.size,
                  borderRadius: item.size / 2,
                },
              ]}
              contentFit="cover"
            />
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
                <Text style={styles.logoInitial}>{initial}</Text>
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
            <Text style={styles.cancelText}>取消匹配</Text>
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
  title: {
    fontFamily: DOUYIN_SANS,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "600",
    color: "#FFFFFF",
    textAlign: "center",
  },
  radar: {
    width: RADAR_SIZE,
    height: RADAR_SIZE,
    position: "relative",
  },
  ringsSvg: {
    ...StyleSheet.absoluteFill,
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
