import { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useEvent, type VideoPlayer } from "react-native-video";

import { circlePlayerPool, type CirclePoolSlot } from "@/features/circle/circle-player-pool";
import { SYSTEM_FONT } from "@/shared/theme/typography";

type CircleVideoProgressBarProps = {
  player: VideoPlayer;
  slot: CirclePoolSlot;
  postId: string;
  videoUrl: string;
  active: boolean;
  playing: boolean;
  bottom: number;
  onScrubbingChange: (scrubbing: boolean) => void;
};

function validTime(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function formatTime(value: number) {
  const seconds = Math.floor(validTime(value));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  const shortTime = `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
  return hours > 0 ? `${String(hours).padStart(2, "0")}:${shortTime}` : shortTime;
}

export function CircleVideoProgressBar({
  player,
  slot,
  postId,
  videoUrl,
  active,
  playing,
  bottom,
  onScrubbingChange,
}: CircleVideoProgressBarProps) {
  const initialDuration = player.source.uri === videoUrl ? validTime(player.duration) : 0;
  const initialPosition = player.source.uri === videoUrl ? validTime(player.currentTime) : 0;
  const [duration, setDuration] = useState(initialDuration);
  const [trackWidth, setTrackWidth] = useState(0);
  const [scrubbing, setScrubbing] = useState(false);
  const [previewSecond, setPreviewSecond] = useState(0);
  const durationValue = useSharedValue(initialDuration);
  const positionValue = useSharedValue(initialPosition);
  const previewValue = useSharedValue(initialPosition);
  const scrubbingValue = useSharedValue(false);
  const progress = useSharedValue(initialDuration > 0 ? initialPosition / initialDuration : 0);

  const updateDuration = useCallback((nextDuration: number) => {
    const value = validTime(nextDuration);
    if (value !== durationValue.get()) {
      durationValue.set(value);
      setDuration(value);
    }
    return value;
  }, [durationValue]);

  const handleLoad = useCallback(
    (data: { currentTime: number; duration: number }) => {
      if (player.source.uri !== videoUrl) {
        return;
      }
      const total = updateDuration(data.duration);
      const position = validTime(data.currentTime);
      positionValue.set(position);
      if (!scrubbingValue.get()) {
        progress.set(total > 0 ? Math.min(position / total, 1) : 0);
      }
    },
    [player, positionValue, progress, scrubbingValue, updateDuration, videoUrl],
  );

  const handleProgress = useCallback(
    (data: { currentTime: number }) => {
      if (!circlePlayerPool.holdsSource(slot, postId)) {
        return;
      }
      const total = updateDuration(player.duration);
      const position = validTime(data.currentTime);
      positionValue.set(position);
      if (!scrubbingValue.get()) {
        progress.set(total > 0 ? Math.min(position / total, 1) : 0);
      }
    },
    [player, positionValue, postId, progress, scrubbingValue, slot, updateDuration],
  );

  useEvent(player, "onLoad", handleLoad);
  useEvent(player, "onProgress", handleProgress);

  const updatePreview = useCallback(
    (x: number) => {
      const total = durationValue.get();
      if (trackWidth <= 0 || total <= 0) {
        return;
      }
      const ratio = Math.max(0, Math.min(x / trackWidth, 1));
      const preview = ratio * total;
      previewValue.set(preview);
      progress.set(ratio);
      setPreviewSecond(Math.floor(preview));
    },
    [durationValue, previewValue, progress, trackWidth],
  );

  const startScrubbing = useCallback(
    (x: number) => {
      if (!active || durationValue.get() <= 0 || !circlePlayerPool.holdsSource(slot, postId)) {
        return;
      }
      scrubbingValue.set(true);
      setScrubbing(true);
      onScrubbingChange(true);
      player.pause();
      updatePreview(x);
    },
    [active, durationValue, onScrubbingChange, player, postId, scrubbingValue, slot, updatePreview],
  );

  const finishScrubbing = useCallback(
    (success: boolean) => {
      if (!scrubbingValue.get()) {
        return;
      }
      scrubbingValue.set(false);
      if (success && circlePlayerPool.holdsSource(slot, postId)) {
        const preview = previewValue.get();
        player.seekTo(preview);
        positionValue.set(preview);
      } else {
        const total = durationValue.get();
        progress.set(total > 0 ? Math.min(positionValue.get() / total, 1) : 0);
      }
      setScrubbing(false);
      onScrubbingChange(false);
      if (active && playing && circlePlayerPool.holdsSource(slot, postId)) {
        player.play();
      }
    },
    [active, durationValue, onScrubbingChange, player, playing, positionValue, postId, previewValue, progress, scrubbingValue, slot],
  );

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(active && duration > 0 && trackWidth > 0)
        .minDistance(0)
        .runOnJS(true)
        .onStart((event) => startScrubbing(event.x))
        .onUpdate((event) => updatePreview(event.x))
        .onFinalize((_event, success) => finishScrubbing(success)),
    [active, duration, finishScrubbing, startScrubbing, trackWidth, updatePreview],
  );

  const fillStyle = useAnimatedStyle(() => ({ width: progress.get() * trackWidth }));
  const thumbStyle = useAnimatedStyle(() => ({
    left: progress.get() * trackWidth - (scrubbing ? 6 : 3),
  }));

  if (!active || duration <= 0) {
    return null;
  }

  const thumbSize = scrubbing ? 12 : 6;
  return (
    <View style={[styles.container, { bottom }]}>
      {scrubbing ? (
        <View pointerEvents="none" style={styles.timeRow}>
          <Text style={styles.currentTime}>{formatTime(previewSecond)}</Text>
          <Text style={styles.separator}>/</Text>
          <Text style={styles.totalTime}>{formatTime(duration)}</Text>
        </View>
      ) : null}
      <GestureDetector gesture={gesture}>
        <View
          style={styles.touchArea}
          onLayout={(event) => {
            const width = event.nativeEvent.layout.width;
            if (width !== trackWidth) {
              setTrackWidth(width);
            }
          }}
        >
          <View style={[styles.track, scrubbing ? styles.trackScrubbing : styles.trackNormal]}>
            <Animated.View style={[styles.fill, fillStyle]} />
            <Animated.View
              style={[
                styles.thumb,
                { width: thumbSize, height: thumbSize, borderRadius: thumbSize / 2 },
                scrubbing ? styles.thumbScrubbing : styles.thumbNormal,
                thumbStyle,
              ]}
            />
          </View>
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: "absolute", left: 12, right: 12, zIndex: 4 },
  touchArea: { height: 32, justifyContent: "center" },
  track: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 12,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.6)",
  },
  trackNormal: { height: 2 },
  trackScrubbing: { height: 8 },
  fill: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 999, backgroundColor: "#FFFFFF" },
  thumb: { position: "absolute", backgroundColor: "#FFFFFF" },
  thumbNormal: { top: -2 },
  thumbScrubbing: { top: -2 },
  timeRow: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 47,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  currentTime: { fontFamily: SYSTEM_FONT, color: "#FFFFFF", fontSize: 18, lineHeight: 26, fontWeight: "500" },
  separator: { fontFamily: SYSTEM_FONT, color: "#FFFFFF", fontSize: 12, lineHeight: 18 },
  totalTime: { fontFamily: SYSTEM_FONT, color: "rgba(255, 255, 255, 0.6)", fontSize: 18, lineHeight: 26, fontWeight: "500" },
});
