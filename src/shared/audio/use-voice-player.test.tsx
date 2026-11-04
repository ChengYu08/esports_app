import { useEffect } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useVoicePlayer } from "./use-voice-player";

const audio = vi.hoisted(() => {
  const removeSubscription = vi.fn();
  const player = {
    pause: vi.fn(),
    play: vi.fn(),
    remove: vi.fn(),
    addListener: vi.fn(() => ({ remove: removeSubscription })),
  };
  return { player, removeSubscription, createAudioPlayer: vi.fn(() => player) };
});

vi.mock("expo-audio", () => ({ createAudioPlayer: audio.createAudioPlayer }));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let renderer: ReactTestRenderer | undefined;
let voice: ReturnType<typeof useVoicePlayer> | undefined;

function Harness() {
  const player = useVoicePlayer();
  useEffect(() => {
    voice = player;
  }, [player]);
  return null;
}

beforeEach(() => {
  vi.clearAllMocks();
  voice = undefined;
});

afterEach(async () => {
  if (renderer) {
    await act(async () => renderer?.unmount());
  }
  renderer = undefined;
});

describe("useVoicePlayer 资源释放", () => {
  it("手动停止时移除播放状态订阅并释放播放器", async () => {
    await act(async () => {
      renderer = create(<Harness />);
    });
    await act(async () => {
      voice?.toggle("https://example.test/voice.mp3");
    });
    await act(async () => {
      voice?.stop();
    });

    expect(audio.removeSubscription).toHaveBeenCalledTimes(1);
    expect(audio.player.pause).toHaveBeenCalledTimes(1);
    expect(audio.player.remove).toHaveBeenCalledTimes(1);
  });

  it("页面卸载时释放仍在播放的资源", async () => {
    await act(async () => {
      renderer = create(<Harness />);
    });
    await act(async () => {
      voice?.toggle("https://example.test/voice.mp3");
    });
    await act(async () => renderer?.unmount());
    renderer = undefined;

    expect(audio.removeSubscription).toHaveBeenCalledTimes(1);
    expect(audio.player.remove).toHaveBeenCalledTimes(1);
  });
});
