import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import type { RefObject } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { getDDinProStyle } from "../theme/typography";
import { VoiceWaveform } from "./VoiceWaveform";

const playBadgeIcon = require("../../../assets/svgs/play-badge.svg");

type VoicePlayButtonProps = {
  url: string;
  duration?: number | null;
  playingUrl: string | null;
  onToggleVoice: (url: string) => void;
  inline?: boolean;
  compact?: boolean;
  /** solid：粉底白字胶囊；pill：浅白毛玻璃胶囊（头像左下角试听标签） */
  tone?: "solid" | "pill";
  /** Android 端背景高斯模糊目标（头像），由调用方用 BlurTargetView 包裹 */
  blurTarget?: RefObject<View | null>;
};

export function VoicePlayButton({
  url,
  duration,
  playingUrl,
  onToggleVoice,
  inline = false,
  compact = false,
  tone = "solid",
  blurTarget,
}: VoicePlayButtonProps) {
  const playing = playingUrl === url;
  const pill = tone === "pill";

  return (
    <Pressable
      accessibilityLabel={playing ? "暂停语音" : "播放语音"}
      accessibilityRole="button"
      hitSlop={compact ? 6 : 0}
      onPress={(event) => {
        event.stopPropagation();
        onToggleVoice(url);
      }}
      style={[
        styles.button,
        inline ? styles.inlineButton : styles.overlayButton,
        compact && styles.compactButton,
        pill && styles.pillButton,
      ]}
    >
      {pill ? (
        <>
          <BlurView
            blurMethod="dimezisBlurView"
            blurTarget={blurTarget}
            intensity={20}
            pointerEvents="none"
            style={styles.pillBlur}
            tint="light"
          />
          <View pointerEvents="none" style={styles.pillTint} />
        </>
      ) : null}
      <View
        style={[
          styles.iconCircle,
          compact && styles.compactIconCircle,
          pill && styles.pillIconCircle,
        ]}
      >
        {playing ? (
          <View
            style={[
              styles.pauseIcon,
              compact && styles.compactPauseIcon,
              pill && styles.pillPauseIcon,
            ]}
          >
            <View
              style={[
                styles.pauseBar,
                compact && styles.compactPauseBar,
                pill && styles.pillPauseBar,
              ]}
            />
            <View
              style={[
                styles.pauseBar,
                compact && styles.compactPauseBar,
                pill && styles.pillPauseBar,
              ]}
            />
          </View>
        ) : pill ? (
          <Image source={playBadgeIcon} style={styles.pillPlayBadge} />
        ) : (
          <Text style={[styles.playIcon, compact && styles.compactPlayIcon]}>
            ▶
          </Text>
        )}
      </View>
      {pill && !playing ? null : (
        <VoiceWaveform playing={playing} compact={compact} barOpacity={0.8} />
      )}
      <Text
        style={[
          styles.duration,
          compact && styles.compactDuration,
          pill && styles.pillDuration,
        ]}
      >
        {duration ?? 0}’’
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 30,
    paddingVertical: 4,
    paddingRight: 8,
    paddingLeft: 4,
    borderRadius: 67,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  compactButton: {
    height: 24,
    paddingVertical: 2,
    paddingRight: 6,
    paddingLeft: 3,
    gap: 3,
  },
  inlineButton: { backgroundColor: "#FF3158" },
  overlayButton: {
    position: "absolute",
    left: 6,
    bottom: 6,
    zIndex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },
  // 头像左下角试听胶囊：白 75% 底 + 白 0.5 描边 + 背景高斯模糊（设计稿 490:79197）
  pillButton: {
    position: "absolute",
    left: 6,
    bottom: 6,
    zIndex: 1,
    height: 22,
    overflow: "hidden",
    borderWidth: 0.5,
    borderColor: "#FFFFFF",
    borderRadius: 99,
    paddingVertical: 3,
    paddingLeft: 4,
    paddingRight: 6,
    gap: 3,
  },
  pillBlur: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 99,
  },
  pillTint: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 99,
    backgroundColor: "rgba(255, 255, 255, 0.75)",
  },
  iconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  compactIconCircle: { width: 18, height: 18, borderRadius: 9 },
  pillIconCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#FE4267",
  },
  playIcon: {
    color: "#FF3158",
    fontSize: 10,
    lineHeight: 11,
    marginLeft: 1,
    marginTop: -3,
  },
  // 紧凑态保持原有视觉位置
  compactPlayIcon: { fontSize: 8, lineHeight: 9, marginTop: -1 },
  pillPlayBadge: { width: 16, height: 16 },
  pauseIcon: { flexDirection: "row", gap: 3 },
  compactPauseIcon: { gap: 2 },
  pillPauseIcon: { gap: 2 },
  pauseBar: {
    width: 3,
    height: 10,
    borderRadius: 1.5,
    backgroundColor: "#FF3158",
  },
  compactPauseBar: { width: 2, height: 8, borderRadius: 1 },
  pillPauseBar: { width: 2, height: 7, backgroundColor: "#FFF" },
  duration: {
    color: "#fff",
    fontSize: 12,
    lineHeight: 14,
    ...getDDinProStyle(700),
  },
  compactDuration: { fontSize: 10, lineHeight: 18 },
  // 设计稿：品牌色 D-DIN-PRO Bold 12/14，引号沿用 12’’
  pillDuration: { color: "#FE4267" },
});
