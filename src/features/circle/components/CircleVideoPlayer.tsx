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
  /** 首帧真实渲染到画面后回调（依据 onProgress currentTime>0，而非 STATE_READY）。 */
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

  const handleProgress = useCallback(
    (progress: { currentTime: number }) => {
      const now = Date.now();
      // currentTime 前进说明解码帧已真实上屏，此时淡出封面才不会露出黑底闪动；
      // holdsSource 过滤换源期间的旧源进度：池内播放器可能刚被上一个视频复用
      if (
        active &&
        !frameShownRef.current &&
        progress.currentTime > 0 &&
        circlePlayerPool.holdsSource(slot, post.id)
      ) {
        frameShownRef.current = true;
        onFirstFrame();
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
    [active, onFirstFrame, post.id, slot, token],
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
      // 与封面 contentFit="cover" 保持一致，避免封面切换到视频时画面尺寸突变产生抖动
      resizeMode="cover"
      controls={false}
      keepScreenAwake={false}
      surfaceType={Platform.OS === "android" ? "texture" : undefined}
      pointerEvents="none"
    />
  );
}
