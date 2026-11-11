import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  joined: vi.fn(), create: vi.fn(), send: vi.fn(), navigate: vi.fn(), toast: vi.fn(),
}));
vi.mock("expo-router", () => ({ router: { push: vi.fn(), replace: vi.fn() } }));
vi.mock("@esports/auth", () => ({ useAuthStore: { getState: () => ({ user: { nickname: "老板" } }) } }));
vi.mock("@/features/message/message-store", () => ({ messageStore: { getState: () => ({ connectionState: "ready", sendText: vi.fn().mockResolvedValue(undefined) }) } }));
vi.mock("@/features/message/rongcloud-im", () => ({ sendRongText: mocks.send }));
vi.mock("@/features/voice-room/voice-room.api", () => ({
  resolveVoiceRoomId: (room: { id?: string } | null) => room?.id ?? null,
  voiceRoomApi: { getJoinedRoom: mocks.joined, createRoom: mocks.create },
}));
vi.mock("@/features/voice-room/navigate-voice-room", () => ({ navigateToVoiceRoom: mocks.navigate }));
vi.mock("@/shared/ui/app-toast", () => ({ showToast: mocks.toast }));

const { afterQuickMatchPaidOpenRoom } = await import("./notify-order-paid");

describe("不试音派单支付后的语聊房", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.send.mockResolvedValue({});
  });

  it("复用当前房间并向所有不同的陪玩发送邀请", async () => {
    mocks.joined.mockResolvedValue({ id: "123", roomVersion: 2 });
    await afterQuickMatchPaidOpenRoom({ token: "token", companionUserIds: ["11", "12", "11"] });
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.send).toHaveBeenCalledTimes(2);
    expect(mocks.send).toHaveBeenCalledWith("11", "https://djpc.jlgkj.top/chat?type=chat-room&id=123&v=2");
    expect(mocks.navigate).toHaveBeenCalledWith({ id: "123", v: "2" });
  });

  it("没有房间时创建，邀请失败仍进入房间并提示", async () => {
    mocks.joined.mockResolvedValue(null);
    mocks.create.mockResolvedValue({ id: "456", roomVersion: 1 });
    mocks.send.mockRejectedValue(new Error("发送失败"));
    await afterQuickMatchPaidOpenRoom({ token: "token", clubId: "9", companionUserIds: ["11"] });
    expect(mocks.create).toHaveBeenCalledWith("老板的语聊房", "token", "9");
    expect(mocks.navigate).toHaveBeenCalledWith({ id: "456", v: "1" });
    expect(mocks.toast).toHaveBeenCalledWith(expect.stringContaining("手动邀请"));
  });

  it("查询房间失败时不创建房间，提示手动处理", async () => {
    mocks.joined.mockRejectedValue(new Error("查询失败"));
    await afterQuickMatchPaidOpenRoom({ token: "token", companionUserIds: ["11"] });
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(expect.stringContaining("支付成功"));
  });

});
