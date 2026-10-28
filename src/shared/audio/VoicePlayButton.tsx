import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { VoiceWaveform } from "./VoiceWaveform";

const playTriangleIcon = require("../../../assets/shared/play-triangle-white.svg");

type VoicePlayButtonProps = {
  url: string;
  duration?: number | null;
  playingUrl: string | null;
  onToggleVoice: (url: string) => void;
  inline?: boolean;
  compact?: boolean;
  /** solid：粉底白字胶囊；light：透明底品牌色图标文字，用于头像左下角试听标签 */
  tone?: "solid" | "light";
};

export function VoicePlayButton({
  url,
  duration,
  playingUrl,
  onToggleVoice,
  inline = false,
  compact = false,
  tone = "solid",
}: VoicePlayButtonProps) {
  const playing = playingUrl === url;
  const light = tone === "light";

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
        inline || light ? styles.inlineButton : styles.overlayButton,
        compact && styles.compactButton,
        light && styles.lightButton,
      ]}
    >
      <View
        style={[
          styles.iconCircle,
          compact && styles.compactIconCircle,
          light && styles.lightIconCircle,
        ]}
      >
        {playing ? (
          <View
            style={[
              styles.pauseIcon,
              compact && styles.compactPauseIcon,
              light && styles.lightPauseIcon,
            ]}
          >
            <View
              style={[styles.pauseBar, compact && styles.compactPauseBar, light && styles.lightPauseBar]}
            />
            <View
              style={[styles.pauseBar, compact && styles.compactPauseBar, light && styles.lightPauseBar]}
            />
          </View>
        ) : light ? (
          <Image source={playTriangleIcon} style={styles.lightPlayTriangle} />
        ) : (
          <Text style={[styles.playIcon, compact && styles.compactPlayIcon]}>
            ▶
          </Text>
        )}
      </View>
      {light && !playing ? null : <VoiceWaveform playing={playing} compact={compact} />}
      <Text style={[styles.duration, compact && styles.compactDuration, light && styles.lightDuration]}>
        {duration ?? 0}
        {light ? "''" : '"'}
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
  compactButton: { height: 24, paddingVertical: 2, paddingRight: 6, paddingLeft: 3, gap: 3 },
  inlineButton: { backgroundColor: "#FF3158" },
  overlayButton: {
    position: "absolute",
    left: 6,
    bottom: 6,
    zIndex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },
  lightButton: {
    height: 20,
    backgroundColor: "transparent",
    borderRadius: 0,
    paddingVertical: 0,
    paddingHorizontal: 0,
    gap: 3,
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
  lightIconCircle: { width: 16, height: 16, borderRadius: 8, backgroundColor: "#FE4267" },
  playIcon: {
    color: "#FF3158",
    fontSize: 10,
    lineHeight: 11,
    marginLeft: 1,
    marginTop: -1,
  },
  compactPlayIcon: { fontSize: 8, lineHeight: 9 },
  lightPlayTriangle: { width: 11, height: 11, marginLeft: 1 },
  pauseIcon: { flexDirection: "row", gap: 3 },
  compactPauseIcon: { gap: 2 },
  lightPauseIcon: { gap: 2 },
  pauseBar: {
    width: 3,
    height: 10,
    borderRadius: 1.5,
    backgroundColor: "#FF3158",
  },
  compactPauseBar: { width: 2, height: 8, borderRadius: 1 },
  lightPauseBar: { width: 2, height: 7, backgroundColor: "#FFF" },
  duration: { color: "#fff", fontSize: 12, lineHeight: 22, fontWeight: "700" },
  compactDuration: { fontSize: 10, lineHeight: 18 },
  lightDuration: { color: "#FE4267", fontSize: 10, lineHeight: 14 },
});
