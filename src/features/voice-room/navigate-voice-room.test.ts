import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const dismissTo = vi.fn();

vi.mock("expo-router", () => ({
  router: { push, dismissTo },
}));

const { navigateToVoiceRoom } = await import("./navigate-voice-room");
const { useVoiceRoomSessionStore } = await import("./voice-room-session");

describe("navigateToVoiceRoom", () => {
  beforeEach(() => {
    push.mockClear();
    dismissTo.mockClear();
    useVoiceRoomSessionStore.getState().setScreenFocused(false);
  });

  it("非聚焦（其他页面进入）时 push，保留中间路由", () => {
    navigateToVoiceRoom({ id: "room-1", v: "2" });

    expect(push).toHaveBeenCalledWith({
      pathname: "/voice-room/[id]",
      params: { id: "room-1", v: "2" },
    });
    expect(dismissTo).not.toHaveBeenCalled();
  });

  it("正聚焦在开黑房屏（房内切房）时 dismissTo 原地换 params，不叠层", () => {
    useVoiceRoomSessionStore.getState().setScreenFocused(true);

    navigateToVoiceRoom({ id: "room-2", v: "1" });

    expect(dismissTo).toHaveBeenCalledWith({
      pathname: "/voice-room/[id]",
      params: { id: "room-2", v: "1" },
    });
    expect(push).not.toHaveBeenCalled();
  });
});
