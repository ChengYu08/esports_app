import { afterEach, describe, expect, it, vi } from "vitest";

import {
  joinVoiceChatRoom,
  leaveVoiceChatRoom,
  sendVoiceChatImageMessage,
  subscribeVoiceChatMembers,
} from "./voice-room-rongcloud";

vi.mock("@/core/logging/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn() } }));

// 转发回调与假引擎需在 vi.mock 工厂外可访问，用 hoisted 容器持有
const rongMocks = vi.hoisted(() => {
  type MemberAction = { userId?: string; actionType?: number };
  return {
    engine: null as Record<string, (...args: never[]) => unknown> | null,
    memberForwarder: null as ((targetId: string, actions: MemberAction[]) => void) | null,
  };
});

vi.mock("@/features/message/rongcloud-im", () => ({
  getRongCloudEngine: vi.fn(() => rongMocks.engine),
  isRongCloudConnected: vi.fn(() => true),
  initializeRongCloud: vi.fn(async () => true),
  subscribeRongChatRoomMessages: vi.fn(() => () => {}),
  subscribeRongChatRoomMembers: vi.fn(
    (callback: (targetId: string, actions: { userId?: string; actionType?: number }[]) => void) => {
      rongMocks.memberForwarder = callback;
      return () => {
        rongMocks.memberForwarder = null;
      };
    },
  ),
  subscribeRongConnectionStatus: vi.fn(() => () => {}),
}));

vi.mock("@rongcloud/react-native-im-wrapper", () => ({
  RCIMIWMessageType: { IMAGE: 2 },
  RCIMIWMessageDirection: { SEND: 1 },
  RCIMIWConversationType: { CHATROOM: 4 },
  RCIMIWTimeOrder: { BEFORE: 1 },
}));

type SentMessage = {
  local?: string;
  remote?: string;
  userInfo?: { userId?: string; name?: string; portrait?: string };
};

function createEngine(options: { sendCode?: number } = {}) {
  const createImageMessage = vi.fn(
    async (_type: number, _targetId: string, _channelId: string, path: string): Promise<SentMessage> =>
      ({ local: path }),
  );
  const sendMessage = vi.fn(async (_message: SentMessage): Promise<number> => options.sendCode ?? 0);
  const sendMediaMessage = vi.fn(async (_message: SentMessage): Promise<number> => 0);
  return {
    engine: {
      createImageMessage,
      sendMessage,
      sendMediaMessage,
    } as unknown as Parameters<typeof sendVoiceChatImageMessage>[0],
    createImageMessage,
    sendMessage,
    sendMediaMessage,
  };
}

describe("sendVoiceChatImageMessage", () => {
  it("预置公网 URL 到 remote 并用 sendMessage 直接发送（不经融云托管）", async () => {
    const mocks = createEngine();

    await sendVoiceChatImageMessage(
      mocks.engine,
      3,
      "room-1",
      "file:///cache/a.jpg",
      "https://cdn.example.com/chat/a.jpg",
      { userId: "1", nickname: "小明", headImage: "https://cdn.example.com/avatar/1.png" },
    );

    expect(mocks.createImageMessage).toHaveBeenCalledWith(3, "room-1", "", "file:///cache/a.jpg");
    expect(mocks.sendMessage).toHaveBeenCalledTimes(1);
    expect(mocks.sendMediaMessage).not.toHaveBeenCalled();
    const message = mocks.sendMessage.mock.calls[0][0] as SentMessage;
    expect(message.remote).toBe("https://cdn.example.com/chat/a.jpg");
    expect(message.userInfo).toEqual({
      userId: "1",
      name: "小明",
      portrait: "https://cdn.example.com/avatar/1.png",
    });
  });

  it("sendMessage 返回非 0 状态码时抛错", async () => {
    const mocks = createEngine({ sendCode: 30010 });

    await expect(
      sendVoiceChatImageMessage(mocks.engine, 3, "room-1", "file:///cache/a.jpg", "https://cdn.example.com/chat/a.jpg"),
    ).rejects.toThrow("发送图片失败（30010）");
  });
});

function createJoinEngine() {
  return {
    joinChatRoom: vi.fn(
      async (
        targetId: string,
        _count: number,
        _autoCreate: boolean,
        callbacks?: { onChatRoomJoined?: (code: number, targetId: string) => void },
      ) => {
        callbacks?.onChatRoomJoined?.(0, targetId);
        return 0;
      },
    ),
    leaveChatRoom: vi.fn(async () => 0),
  } as unknown as Record<string, (...args: never[]) => unknown>;
}

type MemberAction = { userId?: string; actionType?: number };
type ReceivedChunk = { targetId: string; actions: MemberAction[] };

function createCollector() {
  const received: ReceivedChunk[] = [];
  const stop = subscribeVoiceChatMembers((targetId, actions) => {
    received.push({ targetId, actions });
  });
  return { received, stop };
}

describe("聊天室成员事件缓冲", () => {
  afterEach(() => {
    rongMocks.engine = null;
  });

  it("无人订阅期间缓冲成员事件，首个订阅者挂载时冲刷", async () => {
    rongMocks.engine = createJoinEngine();
    await joinVoiceChatRoom("token", "room-buffer");
    rongMocks.memberForwarder?.("room-buffer", [{ userId: "88", actionType: 1 }]);
    rongMocks.memberForwarder?.("room-buffer", [{ userId: "88", actionType: 2 }]);

    const { received, stop } = createCollector();
    expect(received).toEqual([
      {
        targetId: "room-buffer",
        actions: [{ userId: "88", actionType: 1 }, { userId: "88", actionType: 2 }],
      },
    ]);
    stop();
    await leaveVoiceChatRoom("room-buffer");
  });

  it("未加入的房间不缓冲", async () => {
    rongMocks.engine = createJoinEngine();
    rongMocks.memberForwarder?.("room-unknown", [{ userId: "88", actionType: 1 }]);

    const { received, stop } = createCollector();
    expect(received).toEqual([]);
    stop();
  });

  it("订阅者在线时事件直投、不重复也不残留缓冲", async () => {
    rongMocks.engine = createJoinEngine();
    await joinVoiceChatRoom("token", "room-live");
    const first = createCollector();
    const second = createCollector();
    rongMocks.memberForwarder?.("room-live", [{ userId: "99", actionType: 1 }]);

    expect(first.received).toHaveLength(1);
    expect(second.received).toHaveLength(1);
    // 已有订阅者时新订阅不触发冲刷，避免重复投递
    expect(first.received).toHaveLength(1);
    first.stop();
    second.stop();
    await leaveVoiceChatRoom("room-live");
  });

  it("退房时丢弃缓冲", async () => {
    rongMocks.engine = createJoinEngine();
    await joinVoiceChatRoom("token", "room-gone");
    rongMocks.memberForwarder?.("room-gone", [{ userId: "88", actionType: 1 }]);
    await leaveVoiceChatRoom("room-gone");

    const { received, stop } = createCollector();
    expect(received).toEqual([]);
    stop();
  });

  it("缓冲超限时只保留最近的事件", async () => {
    rongMocks.engine = createJoinEngine();
    await joinVoiceChatRoom("token", "room-cap");
    for (let index = 0; index < 120; index += 1) {
      rongMocks.memberForwarder?.("room-cap", [{ userId: `u${index}`, actionType: 1 }]);
    }

    const received: MemberAction[] = [];
    const stop = subscribeVoiceChatMembers((_targetId, actions) => {
      received.push(...actions);
    });
    expect(received).toHaveLength(100);
    expect(received[0]?.userId).toBe("u20");
    expect(received.at(-1)?.userId).toBe("u119");
    stop();
    await leaveVoiceChatRoom("room-cap");
  });
});
