import { createAudioPlayer, type AudioPlayer } from "expo-audio";
import { useCallback, useEffect, useRef, useState } from "react";

export function useVoicePlayer() {
  const playerRef = useRef<AudioPlayer | null>(null);
  const subscriptionRef = useRef<{ remove: () => void } | null>(null);
  const playingUrlRef = useRef<string | null>(null);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);

  const release = useCallback((updateState: boolean) => {
    // 手动停止和页面离开时都先移除事件订阅，避免旧播放器回调继续持有页面。
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
    playerRef.current?.pause();
    playerRef.current?.remove();
    playerRef.current = null;
    playingUrlRef.current = null;
    if (updateState) {
      setPlayingUrl(null);
    }
  }, []);

  const stop = useCallback(() => {
    release(true);
  }, [release]);

  const toggle = useCallback((voiceUrl: string) => {
    if (playingUrlRef.current === voiceUrl) {
      stop();
      return;
    }
    stop();
    const player = createAudioPlayer(voiceUrl);
    playerRef.current = player;
    playingUrlRef.current = voiceUrl;
    setPlayingUrl(voiceUrl);
    subscriptionRef.current = player.addListener("playbackStatusUpdate", (status) => {
      if (
        status.didJustFinish ||
        (status.duration > 0 &&
          status.currentTime >= status.duration &&
          !status.playing)
      ) {
        if (playerRef.current === player) {
          stop();
        }
      }
    });
    player.play();
  }, [stop]);

  useEffect(() => () => release(false), [release]);

  return { playingUrl, stop, toggle };
}
