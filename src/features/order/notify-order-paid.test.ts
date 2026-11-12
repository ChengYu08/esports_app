import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  joined: vi.fn(), create: vi.fn(), send: vi.fn(), paidSend: vi.fn(), navigate: vi.fn(), toast: vi.fn(), dismissTo: vi.fn(),
}));
vi.mock("expo-router", () => ({ router: { push: vi.fn(), replace: vi.fn(), dismissTo: mocks.dismissTo } }));
vi.mock("@esports/auth", () => ({ useAuthStore: { getState: () => ({ user: { nickname: "老板" } }) } }));
vi.mock("@/features/message/message-store", () => ({ messageStore: { getState: () => ({ connectionState: "ready", sendText: mocks.paidSend }) } }));
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
    mocks.paidSend.mockResolvedValue(undefined);
  });

  it("复用当前房间并向所有不同的陪玩发送邀请", async () => {
    mocks.joined.mockResolvedValue({ id: "123", roomVersion: 2, roomType: "PERSONAL" });
    await afterQuickMatchPaidOpenRoom({ token: "token", companionUserIds: ["11", "12", "11"] });
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.send).toHaveBeenCalledTimes(2);
    expect(mocks.send).toHaveBeenCalledWith("11", "https://djpc.jlgkj.top/chat?type=chat-room&id=123&v=2");
    expect(mocks.navigate).toHaveBeenCalledWith({ id: "123", v: "2" });
    expect(mocks.dismissTo).not.toHaveBeenCalled();
  });

  it.each([false, true])("在频道房时不创建或发送飞机票，提示先退出频道房（匹配页入口：%s）", async (returnToOrders) => {
    mocks.joined.mockResolvedValue({ id: "channel-1", roomVersion: 2, roomType: "CHANNEL" });
    await afterQuickMatchPaidOpenRoom({
      token: "token",
      companionUserIds: ["11"],
      returnToOrders,
    });

    expect(mocks.toast).toHaveBeenCalledExactlyOnceWith("自动创建语聊房失败，请先退出当前频道语聊房。");
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(mocks.paidSend).toHaveBeenCalledWith("11", "我已支付订单~");
    expect(mocks.dismissTo).toHaveBeenCalledTimes(returnToOrders ? 1 : 0);
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

  it("匹配页支付后先回我下单列表，再打开语聊房，退房不再返回选人页", async () => {
    mocks.joined.mockResolvedValue({ id: "123", roomVersion: 2 });
    await afterQuickMatchPaidOpenRoom({
      token: "token",
      companionUserIds: ["11"],
      returnToOrders: true,
    });

    expect(mocks.dismissTo).toHaveBeenCalledWith({
      pathname: "/(tabs)/order",
      params: { scope: "place" },
    });
    expect(mocks.dismissTo.mock.invocationCallOrder[0]).toBeLessThan(mocks.joined.mock.invocationCallOrder[0]);
    expect(mocks.dismissTo.mock.invocationCallOrder[0]).toBeLessThan(mocks.navigate.mock.invocationCallOrder[0]);
    expect(mocks.navigate).toHaveBeenCalledWith({ id: "123", v: "2" });
  });

  it.each(["查询失败", "建房失败"])("匹配页支付后即使%s，也已退出选人流程落在订单页", async (reason) => {
    if (reason === "查询失败") {
      mocks.joined.mockRejectedValue(new Error(reason));
    } else {
      mocks.joined.mockResolvedValue(null);
      mocks.create.mockRejectedValue(new Error(reason));
    }
    await afterQuickMatchPaidOpenRoom({
      token: "token",
      companionUserIds: ["11"],
      returnToOrders: true,
    });

    expect(mocks.dismissTo).toHaveBeenCalledWith({
      pathname: "/(tabs)/order",
      params: { scope: "place" },
    });
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(expect.stringContaining(reason));
  });

});
