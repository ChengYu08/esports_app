import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const dismissTo = vi.fn();
const back = vi.fn();
const replace = vi.fn();
const dismiss = vi.fn();

vi.mock("expo-router", () => ({
  router: { push, dismissTo, back, replace, dismiss },
}));

const { navigateToVoiceRoom } = await import("./navigate-voice-room");
const { useVoiceRoomSessionStore } = await import("./voice-room-session");

describe("navigateToVoiceRoom", () => {
  beforeEach(() => {
    push.mockClear();
    dismissTo.mockClear();
    back.mockClear();
    replace.mockClear();
    dismiss.mockClear();
    useVoiceRoomSessionStore.getState().setScreenFocused(false);
  });

  it("房内图片预览点击侧边入口，返回原房间实例，不重新进房加载历史", () => {
    navigateToVoiceRoom({ id: "room-1", v: "2" }, {
      index: 2,
      routes: [
        { name: "(tabs)" },
        { name: "voice-room/[id]", params: { id: "room-1", v: "2" } },
        { name: "image-preview" },
      ],
    });

    expect(back).toHaveBeenCalledOnce();
    expect(push).not.toHaveBeenCalled();
    expect(dismissTo).not.toHaveBeenCalled();
  });

  it("非聚焦（其他页面进入）时 push，保留中间路由", () => {
    navigateToVoiceRoom({ id: "room-1", v: "2" });

    expect(push).toHaveBeenCalledWith({
      pathname: "/voice-room/[id]",
      params: { id: "room-1", v: "2" },
    });
    expect(dismissTo).not.toHaveBeenCalled();
  });

  it.each([
    { name: "message/chat/[id]", params: { id: "room-1", v: "2" } },
    { name: "voice-room/[id]", params: { id: "room-2", v: "2" } },
    { name: "voice-room/[id]", params: { id: "room-1", v: "1" } },
  ])("预览下方不是当前房间实例时替换预览进房：%j", (previousRoute) => {
    navigateToVoiceRoom({ id: "room-1", v: "2" }, {
      index: 1,
      routes: [previousRoute, { name: "image-preview" }],
    });

    expect(replace).toHaveBeenCalledWith({
      pathname: "/voice-room/[id]",
      params: { id: "room-1", v: "2" },
    });
    expect(push).not.toHaveBeenCalled();
    expect(back).not.toHaveBeenCalled();
  });

  it("房间上方还有聊天页时替换预览，保留中间聊天页", () => {
    navigateToVoiceRoom({ id: "room-1", v: "2" }, {
      index: 2,
      routes: [
        { name: "voice-room/[id]", params: { id: "room-1", v: "2" } },
        { name: "message/chat/[id]" },
        { name: "image-preview" },
      ],
    });

    expect(replace).toHaveBeenCalledOnce();
    expect(push).not.toHaveBeenCalled();
    expect(back).not.toHaveBeenCalled();
    expect(dismissTo).not.toHaveBeenCalled();
  });

  it("同房间上方存在多层旧预览时一次收起所有预览", () => {
    navigateToVoiceRoom({ id: "room-1", v: "2" }, {
      index: 3,
      routes: [
        { name: "(tabs)" },
        { name: "voice-room/[id]", params: { id: "room-1", v: "2" } },
        { name: "image-preview" },
        { name: "image-preview" },
      ],
    });

    expect(dismiss).toHaveBeenCalledWith(2);
    expect(push).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("无版本参数的房间打开图片后仍返回原实例", () => {
    navigateToVoiceRoom({ id: "room-1", v: "2" }, {
      index: 1,
      routes: [
        { name: "voice-room/[id]", params: { id: "room-1" } },
        { name: "image-preview" },
      ],
    });

    expect(back).toHaveBeenCalledOnce();
    expect(push).not.toHaveBeenCalled();
  });

  it("正聚焦在语聊房屏（房内切房）时 dismissTo 原地换 params，不叠层", () => {
    useVoiceRoomSessionStore.getState().setScreenFocused(true);

    navigateToVoiceRoom({ id: "room-2", v: "1" });

    expect(dismissTo).toHaveBeenCalledWith({
      pathname: "/voice-room/[id]",
      params: { id: "room-2", v: "1" },
    });
    expect(push).not.toHaveBeenCalled();
  });
});
