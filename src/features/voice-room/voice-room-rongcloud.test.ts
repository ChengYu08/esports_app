import { afterEach, describe, expect, it, vi } from "vitest";

import {
  joinVoiceChatRoom,
  fetchVoiceChatHistory,
  leaveVoiceChatRoom,
  sendVoiceChatImageMessage,
  sendVoiceChatRoomMessage,
  subscribeVoiceChatMessages,
  subscribeVoiceChatMembers,
} from "./voice-room-rongcloud";
import {
  appendCachedVoiceChatMessage,
  clearVoiceChatMessageCache,
  getCachedVoiceChatMessages,
} from "./voice-room-message-cache";

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
  targetId?: string;
  local?: string;
  remote?: string;
  userInfo?: { userId?: string; name?: string; portrait?: string };
};

function createEngine(options: { sendCode?: number } = {}) {
  const createImageMessage = vi.fn(
    async (_type: number, _targetId: string, _channelId: string, path: string): Promise<SentMessage> =>
      ({ local: path, targetId: _targetId }),
  );
  const sendMessage = vi.fn(async (
    message: SentMessage,
    callback?: { onMessageSent?: (code: number, message: SentMessage) => void },
  ): Promise<number> => {
    const code = options.sendCode ?? 0;
    if (code === 0) {
      callback?.onMessageSent?.(0, message);
    }
    return code;
  });
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

describe("聊天室发送回执", () => {
  afterEach(() => {
    vi.useRealTimers();
    clearVoiceChatMessageCache("room-send");
  });

  it("发送受理后无回执，超时释放等待且忽略迟到回执", async () => {
    vi.useFakeTimers();
    type Callback = NonNullable<Parameters<Parameters<typeof sendVoiceChatRoomMessage>[0]["sendMessage"]>[1]>;
    let callback: Callback | undefined;
    const engine = { sendMessage: vi.fn(async (_message, next) => { callback = next; return 0; }) } satisfies Parameters<typeof sendVoiceChatRoomMessage>[0];
    const local = { id: "local-timeout", text: "你好", kind: "chat" as const, sentAt: 1 };
    appendCachedVoiceChatMessage("room-send", local);
    let error: Error | undefined;
    const pending = sendVoiceChatRoomMessage(engine, { targetId: "room-send" }, local.id).catch((failure) => { error = failure; });
    await vi.advanceTimersByTimeAsync(30_001);
    expect(error?.message).toContain("超时");
    callback?.onMessageSent?.(0, { messageUId: "late" });
    await pending;
    expect(getCachedVoiceChatMessages("room-send")[0].id).toBe(local.id);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["文字", "图片"])("%s 等待真实回执，最小化期间也替换缓存 ID", async (kind) => {
    const local = {
      id: "local-1", text: kind === "文字" ? "你好" : "", kind: "chat" as const,
      imageUrl: kind === "图片" ? "file:///a.jpg" : undefined, sentAt: 100,
    };
    appendCachedVoiceChatMessage("room-send", local);
    type Callback = NonNullable<Parameters<Parameters<typeof sendVoiceChatRoomMessage>[0]["sendMessage"]>[1]>;
    let callback: Callback | undefined;
    const engine = {
      sendMessage: vi.fn(async (_message, callbacks) => {
        callback = callbacks;
        return 0;
      }),
    } satisfies Parameters<typeof sendVoiceChatRoomMessage>[0];
    const completed = vi.fn();
    const pending = sendVoiceChatRoomMessage(engine, { targetId: "room-send" }, local.id).then(completed);
    await Promise.resolve();
    expect(completed).not.toHaveBeenCalled();
    // 无页面订阅，模拟用户发送后立即最小化。
    callback?.onMessageSent?.(0, { messageUId: "server-1", sentTime: 120 });
    await pending;
    appendCachedVoiceChatMessage("room-send", { ...local, id: "server-1", sentAt: 120 });
    expect(getCachedVoiceChatMessages("room-send")).toEqual([{ ...local, id: "server-1", sentAt: 120 }]);
  });

  it("重进后的历史先到、回执后到，合并临时消息并通知当前页面", async () => {
    const local = { id: "local-1", text: "重复内容", kind: "chat" as const, sentAt: 100 };
    appendCachedVoiceChatMessage("room-send", local);
    appendCachedVoiceChatMessage("room-send", { ...local, id: "server-1", sentAt: 110 });
    // 用户确实发送的第二条相同内容必须保留。
    appendCachedVoiceChatMessage("room-send", { ...local, id: "server-2", sentAt: 115 });
    const listener = vi.fn();
    const stop = subscribeVoiceChatMessages(listener);
    try {
      const engine = {
        sendMessage: vi.fn(async (_message, callback) => {
          callback?.onMessageSent?.(0, { messageUId: "server-1", sentTime: 110 });
          return 0;
        }),
      } satisfies Parameters<typeof sendVoiceChatRoomMessage>[0];
      await sendVoiceChatRoomMessage(engine, { targetId: "room-send" }, local.id);
      expect(getCachedVoiceChatMessages("room-send").map((item) => item.id)).toEqual(["server-1", "server-2"]);
      expect(listener).toHaveBeenCalledWith("room-send", expect.objectContaining({ id: "server-1", localId: "local-1" }));
    } finally {
      stop();
    }
  });

  it("SDK 接受发送后仍可能失败，应向调用方报错并保留临时记录", async () => {
    const local = { id: "local-1", text: "你好", sentAt: 100 };
    appendCachedVoiceChatMessage("room-send", local);
    const engine = {
      sendMessage: vi.fn(async (_message, callback) => {
        callback?.onMessageSent?.(30010, {});
        return 0;
      }),
    } satisfies Parameters<typeof sendVoiceChatRoomMessage>[0];
    await expect(sendVoiceChatRoomMessage(engine, { targetId: "room-send" }, local.id)).rejects.toThrow("30010");
    expect(getCachedVoiceChatMessages("room-send")).toEqual([local]);
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

describe("语聊房网络无回调", () => {
  afterEach(() => { vi.useRealTimers(); rongMocks.engine = null; });

  it.each(["成功", "提交失败", "回调失败", "原生抛错"])("历史查询%s 会立即完成并清理超时任务", async (mode) => {
    vi.useFakeTimers();
    const engine = { getChatRoomMessages: vi.fn((_id, _time, _order, _count, callback) => {
      if (mode === "原生抛错") { throw new Error("原生异常"); }
      if (mode === "提交失败") { return Promise.resolve(30001); }
      if (mode === "回调失败") { callback?.onError?.(30002); }
      else { callback?.onSuccess?.([]); }
      return Promise.resolve(0);
    }) } satisfies Parameters<typeof fetchVoiceChatHistory>[0];
    const pending = fetchVoiceChatHistory(engine, "room-history", 1);
    if (mode === "成功") { await expect(pending).resolves.toEqual([]); }
    else { await expect(pending).rejects.toThrow(); }
    expect(vi.getTimerCount()).toBe(0);
  });

  it("入房超时后能重试，迟到回调不将旧请求标记为已加入", async () => {
    vi.useFakeTimers();
    let callback: ((code: number, room: string) => void) | undefined;
    const join = vi.fn(async (_room, _count, _auto, callbacks) => { callback = callbacks.onChatRoomJoined; return 0; });
    rongMocks.engine = { joinChatRoom: join };
    let error: Error | undefined;
    const pending = joinVoiceChatRoom("token", "room-timeout").catch((failure) => { error = failure; });
    await vi.advanceTimersByTimeAsync(15_001);
    expect(error?.message).toContain("超时");
    callback?.(0, "room-timeout");
    await pending;
    rongMocks.engine = createJoinEngine();
    await joinVoiceChatRoom("token", "room-timeout");
    expect(rongMocks.engine.joinChatRoom).toHaveBeenCalledOnce();
    await leaveVoiceChatRoom("room-timeout");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("历史查询无回调时超时返回错误", async () => {
    vi.useFakeTimers();
    const engine = { getChatRoomMessages: vi.fn(async () => 0) };
    let error: Error | undefined;
    const pending = fetchVoiceChatHistory(engine, "room-history-timeout", 1).catch((failure) => { error = failure; });
    await vi.advanceTimersByTimeAsync(15_001);
    expect(error?.message).toContain("超时");
    await pending;
    expect(vi.getTimerCount()).toBe(0);
  });
});

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
