import { Pressable, StyleSheet, Text, View } from "react-native";

import { VoiceWaveform } from "./VoiceWaveform";

type VoicePlayButtonProps = {
  url: string;
  duration?: number | null;
  playingUrl: string | null;
  onToggleVoice: (url: string) => void;
  inline?: boolean;
  compact?: boolean;
};

export function VoicePlayButton({
  url,
  duration,
  playingUrl,
  onToggleVoice,
  inline = false,
  compact = false,
}: VoicePlayButtonProps) {
  const playing = playingUrl === url;

  return (
    <Pressable
      accessibilityLabel={playing ? "暂停语音" : "播放语音"}
      accessibilityRole="button"
      hitSlop={compact ? 6 : 0}
      onPress={(event) => {
        event.stopPropagation();
        onToggleVoice(url);
      }}
      style={[styles.button, inline ? styles.inlineButton : styles.overlayButton, compact && styles.compactButton]}
    >
      <View style={[styles.iconCircle, compact && styles.compactIconCircle]}>
        {playing ? (
          <View style={[styles.pauseIcon, compact && styles.compactPauseIcon]}>
            <View style={[styles.pauseBar, compact && styles.compactPauseBar]} />
            <View style={[styles.pauseBar, compact && styles.compactPauseBar]} />
          </View>
        ) : (
          <Text style={[styles.playIcon, compact && styles.compactPlayIcon]}>▶</Text>
        )}
      </View>
      <VoiceWaveform playing={playing} compact={compact} />
      <Text style={[styles.duration, compact && styles.compactDuration]}>{duration ?? 0}&quot;&quot;</Text>
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
  playIcon: {
    color: "#FF3158",
    fontSize: 10,
    lineHeight: 11,
    marginLeft: 1,
  },
  compactPlayIcon: { fontSize: 8, lineHeight: 9 },
  pauseIcon: { flexDirection: "row", gap: 3 },
  compactPauseIcon: { gap: 2 },
  pauseBar: {
    width: 3,
    height: 10,
    borderRadius: 1.5,
    backgroundColor: "#FF3158",
  },
  compactPauseBar: { width: 2, height: 8, borderRadius: 1 },
  duration: { color: "#fff", fontSize: 12, lineHeight: 22, fontWeight: "700" },
  compactDuration: { fontSize: 10, lineHeight: 18 },
});
