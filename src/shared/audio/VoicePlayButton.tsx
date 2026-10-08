import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
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

type VoicePlayButtonProps = {
  url: string;
  duration?: number | null;
  playingUrl: string | null;
  onToggleVoice: (url: string) => void;
  inline?: boolean;
};

const BAR_HEIGHTS = [8, 14, 10, 12];

export function VoicePlayButton({
  url,
  duration,
  playingUrl,
  onToggleVoice,
  inline = false,
}: VoicePlayButtonProps) {
  const playing = playingUrl === url;

  return (
    <Pressable
      accessibilityLabel={playing ? "暂停语音" : "播放语音"}
      accessibilityRole="button"
      onPress={(event) => {
        event.stopPropagation();
        onToggleVoice(url);
      }}
      style={[styles.button, inline ? styles.inlineButton : styles.overlayButton]}
    >
      <View style={styles.iconCircle}>
        {playing ? (
          <View style={styles.pauseIcon}>
            <View style={styles.pauseBar} />
            <View style={styles.pauseBar} />
          </View>
        ) : (
          <Text style={styles.playIcon}>▶</Text>
        )}
      </View>
      <View style={styles.wave} accessibilityElementsHidden>
        {BAR_HEIGHTS.map((height, index) => (
          <WaveBar
            key={height}
            delay={index * 120}
            height={height}
            playing={playing}
          />
        ))}
      </View>
      <Text style={styles.duration}>{duration ?? 0}&quot;&quot;</Text>
    </Pressable>
  );
}

function WaveBar({
  delay,
  height,
  playing,
}: {
  delay: number;
  height: number;
  playing: boolean;
}) {
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
  }, [delay, playing, reducedMotion, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: scale.get() }],
  }));

  return <Animated.View style={[styles.bar, { height }, animatedStyle]} />;
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
  playIcon: {
    color: "#FF3158",
    fontSize: 10,
    lineHeight: 11,
    marginLeft: 1,
  },
  pauseIcon: { flexDirection: "row", gap: 3 },
  pauseBar: {
    width: 3,
    height: 10,
    borderRadius: 1.5,
    backgroundColor: "#FF3158",
  },
  wave: {
    width: 20,
    height: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2.5,
    flexShrink: 0,
  },
  bar: {
    width: 2,
    borderRadius: 1,
    backgroundColor: "#fff",
    transformOrigin: "center",
  },
  duration: { color: "#fff", fontSize: 12, lineHeight: 22, fontWeight: "700" },
});
