import { useEffect } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  appendCachedVoiceChatMessage,
  clearVoiceChatMessageCache,
} from "./voice-room-message-cache";
import { useVoiceRoomMessages } from "./use-voice-room-messages";
import type { VoiceRoomMessage } from "./voice-room.types";

vi.mock("./message-display", () => ({
  displayMessage: vi.fn(() => null),
  messageKeyExtractor: (item: VoiceRoomMessage) => item.id,
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

type MessagesApi = ReturnType<typeof useVoiceRoomMessages>;

let renderer: ReactTestRenderer | undefined;
let api: MessagesApi | undefined;

function Harness({ chatroomId }: { chatroomId?: string }) {
  const result = useVoiceRoomMessages(() => undefined, chatroomId);
  useEffect(() => {
    api = result;
  }, [result]);
  return null;
}

async function mount(chatroomId?: string) {
  await act(async () => {
    renderer = create(<Harness chatroomId={chatroomId} />);
  });
}

async function unmount() {
  await act(async () => renderer?.unmount());
  renderer = undefined;
}

function sendLocalMessage(id: string) {
  act(() => {
    api?.setMessages((items) => [
      ...items,
      { id, text: `消息${id}`, kind: "chat", sentAt: Date.now() },
    ]);
  });
}

beforeEach(() => {
  api = undefined;
  clearVoiceChatMessageCache("room_1");
  clearVoiceChatMessageCache("room_2");
});

afterEach(async () => {
  await unmount();
});

describe("useVoiceRoomMessages 会话级消息缓存", () => {
  it("发送消息后最小化再进入，聊天记录保留", async () => {
    await mount("room_1");
    sendLocalMessage("m1");
    expect(api?.messages.some((item) => item.id === "m1")).toBe(true);

    // 最小化：屏组件卸载
    await unmount();
    // 悬浮窗重进：新屏实例挂载
    await mount("room_1");

    expect(api?.messages.some((item) => item.id === "m1")).toBe(true);
    expect(api?.messages.some((item) => item.id === "welcome")).toBe(true);
  });

  it("最小化期间收到的消息，重进后可见", async () => {
    await mount("room_1");
    await unmount();

    // 屏幕卸载期间融云分发层持续追加缓存
    appendCachedVoiceChatMessage("room_1", {
      id: "m2",
      text: "晚到的消息",
      kind: "chat",
      sentAt: 2,
    });

    await mount("room_1");
    expect(api?.messages.some((item) => item.id === "m2")).toBe(true);
  });

  it("真正退房清空缓存后重进，只剩欢迎公告", async () => {
    await mount("room_1");
    sendLocalMessage("m1");
    await unmount();

    clearVoiceChatMessageCache("room_1");
    await mount("room_1");

    expect(api?.messages.some((item) => item.id === "m1")).toBe(false);
    expect(api?.messages.some((item) => item.id === "welcome")).toBe(true);
  });

  it("房内切房时切换到新房消息，不残留旧房记录", async () => {
    await mount("room_1");
    sendLocalMessage("m1");

    await act(async () => {
      renderer?.update(<Harness chatroomId="room_2" />);
    });

    expect(api?.messages.some((item) => item.id === "m1")).toBe(false);
    expect(api?.messages.some((item) => item.id === "welcome")).toBe(true);
  });

  it("重复投递的相同 id 消息只保留一条", async () => {
    await mount("room_1");
    await unmount();

    appendCachedVoiceChatMessage("room_1", {
      id: "m3",
      text: "重复消息",
      kind: "chat",
      sentAt: 3,
    });
    appendCachedVoiceChatMessage("room_1", {
      id: "m3",
      text: "重复消息",
      kind: "chat",
      sentAt: 3,
    });

    await mount("room_1");
    expect(api?.messages.filter((item) => item.id === "m3")).toHaveLength(1);
  });
});
