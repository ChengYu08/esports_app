import { describe, expect, it, vi } from "vitest";

import { sendVoiceChatImageMessage } from "./voice-room-rongcloud";

vi.mock("@/core/logging/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn() } }));
vi.mock("@/features/message/rongcloud-im", () => ({
  getRongCloudEngine: vi.fn(() => null),
  isRongCloudConnected: vi.fn(() => true),
  initializeRongCloud: vi.fn(async () => true),
  subscribeRongChatRoomMessages: vi.fn(() => () => {}),
  subscribeRongChatRoomMembers: vi.fn(() => () => {}),
  subscribeRongConnectionStatus: vi.fn(() => () => {}),
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
