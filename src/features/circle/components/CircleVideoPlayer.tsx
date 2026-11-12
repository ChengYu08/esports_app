import { useEvent, VideoView } from "react-native-video";
import { useCallback, useEffect, useRef } from "react";
import { Platform, StyleSheet } from "react-native";

import type { CircleVideoPost } from "@/features/circle/circle-data";
import { circlePlayerPool, type CirclePoolSlot } from "@/features/circle/circle-player-pool";
import { reportCircleVideoPlay } from "@/features/circle/circle.api";

type CircleVideoPlayerProps = {
  /** 池分配的播放器实例；父级保证非空才渲染本组件。 */
  player: NonNullable<ReturnType<typeof circlePlayerPool.getPlayer>>;
  slot: CirclePoolSlot;
  post: CircleVideoPost;
  active: boolean;
  shouldPlay: boolean;
  token?: string;
  /** 播放画面可显示后回调；预加载错过事件时由播放进度兜底。 */
  onFirstFrame: () => void;
  onError: () => void;
};

export function CircleVideoPlayer({
  player,
  slot,
  post,
  active,
  shouldPlay,
  token,
  onFirstFrame,
  onError,
}: CircleVideoPlayerProps) {
  const playedMs = useRef(0);
  const lastProgressAt = useRef<number | null>(null);
  const reported = useRef(false);
  const isPlayingRef = useRef(false);
  const frameShownRef = useRef(false);

  const revealFirstFrame = useCallback(() => {
    if (
      !active ||
      frameShownRef.current ||
      !circlePlayerPool.holdsSource(slot, post.id)
    ) {
      return;
    }
    frameShownRef.current = true;
    onFirstFrame();
  }, [active, onFirstFrame, post.id, slot]);

  const handleProgress = useCallback(
    (progress: { currentTime: number }) => {
      const now = Date.now();
      // 预加载可能早于视图挂载，进度推进时补触发封面淡出
      if (progress.currentTime > 0) {
        revealFirstFrame();
      }
      if (active && isPlayingRef.current && lastProgressAt.current !== null) {
        const elapsed = now - lastProgressAt.current;
        if (elapsed > 0 && elapsed <= 1500) {
          playedMs.current += elapsed;
        }
        if (!reported.current && playedMs.current >= 3000 && token) {
          reported.current = true;
          void reportCircleVideoPlay({
            videoId: post.id,
            durationMs: Math.round(playedMs.current),
            token,
          });
        }
      }
      lastProgressAt.current = Number.isFinite(progress.currentTime) ? now : null;
    },
    [active, post.id, revealFirstFrame, token],
  );

  const handlePlaybackState = useCallback(
    (state: { isPlaying: boolean; isBuffering: boolean }) => {
      const playing = state.isPlaying && !state.isBuffering;
      isPlayingRef.current = playing;
      if (!playing) {
        lastProgressAt.current = null;
      }
    },
    [],
  );

  // useEvent 以 player 实例为依赖，池换绑后自动重订阅
  useEvent(player, "onReadyToDisplay", revealFirstFrame);
  useEvent(player, "onProgress", handleProgress);
  useEvent(player, "onPlaybackStateChange", handlePlaybackState);
  useEvent(player, "onError", onError);

  useEffect(() => {
    if (!active) {
      // 离开本页后重置，回滑重新激活时再次等待首帧确认
      frameShownRef.current = false;
    }
  }, [active]);

  useEffect(() => {
    if (active && shouldPlay) {
      player.play();
    } else {
      player.pause();
      lastProgressAt.current = null;
    }
  }, [active, player, shouldPlay]);

  useEffect(
    () => () => {
      if (!reported.current && playedMs.current >= 3000 && token) {
        void reportCircleVideoPlay({
          videoId: post.id,
          durationMs: Math.round(playedMs.current),
          token,
        });
      }
    },
    [post.id, token],
  );

  // 仍始终渲染 VideoView：窗口内卡片的绑定在翻页时不变，surface 提前建立
  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      // 等比完整显示视频，封面使用相同模式，避免首帧切换时画面尺寸突变
      resizeMode="contain"
      controls={false}
      keepScreenAwake={false}
      surfaceType={Platform.OS === "android" ? "texture" : undefined}
      pointerEvents="none"
    />
  );
}
