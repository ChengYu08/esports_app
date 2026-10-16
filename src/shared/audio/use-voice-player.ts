import { createAudioPlayer, type AudioPlayer } from "expo-audio";
import { useCallback, useEffect, useRef, useState } from "react";

export function useVoicePlayer() {
  const playerRef = useRef<AudioPlayer | null>(null);
  const playingUrlRef = useRef<string | null>(null);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);

  const stop = useCallback(() => {
    playerRef.current?.pause();
    playerRef.current?.remove();
    playerRef.current = null;
    playingUrlRef.current = null;
    setPlayingUrl(null);
  }, []);

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
    const subscription = player.addListener("playbackStatusUpdate", (status) => {
      if (
        status.didJustFinish ||
        (status.duration > 0 &&
          status.currentTime >= status.duration &&
          !status.playing)
      ) {
        subscription.remove();
        player.remove();
        if (playerRef.current === player) {
          playerRef.current = null;
          playingUrlRef.current = null;
          setPlayingUrl(null);
        }
      }
    });
    player.play();
  }, [stop]);

  useEffect(() => stop, [stop]);

  return { playingUrl, stop, toggle };
}
