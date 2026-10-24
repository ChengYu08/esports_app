import { describe, expect, it } from "vitest";

import { mapRongMessage, messagePreview, type RongSdkMessage } from "./chat-message";

const enums = { image: 4, send: 0 };

const invitePayload = {
  commandName: "CUSTOMER_SERVICE_INVITE_CUSTOM",
  roomId: 123,
  clubId: 45,
  roomVersion: 2,
  playerUserId: 999,
  playerName: "小明",
  expireAt: 1_792_128_660,
  rongChatroomId: "rc-1",
  rtcChannelName: "rtc-1",
};

describe("dispatch assistant invite messages", () => {
  it("maps a realtime dispatchInvite custom message", () => {
    const message: RongSdkMessage = {
      messageUId: "cs-1",
      messageIdentifier: "RC:CustomMsg",
      fields: { name: "dispatchInvite", data: JSON.stringify(invitePayload) },
      sentTime: 1_792_128_600_000,
      direction: 1,
    };
    expect(mapRongMessage(message, enums)).toEqual({
      id: "cs-1",
      kind: "csInvite",
      roomId: "123",
      clubId: "45",
      roomVersion: "2",
      playerUserId: "999",
      playerName: "小明",
      expireAt: 1_792_128_660,
      rongChatroomId: "rc-1",
      rtcChannelName: "rtc-1",
      time: expect.any(String),
      isMine: false,
    });
  });

  it.each([
    { objectName: "RC:CustomMsg", rawData: JSON.stringify({ name: "dispatchInvite", data: JSON.stringify(invitePayload) }) },
    { messageIdentifier: "RC:CustomMsg", fields: { name: "dispatchInvite", data: JSON.stringify(invitePayload) } },
  ])("maps the server-persisted dispatchInvite envelope: %j", (body) => {
    const message: RongSdkMessage = { ...body, messageUId: "cs-2", direction: 1 };
    expect(mapRongMessage(message, enums)).toMatchObject({
      id: "cs-2",
      kind: "csInvite",
      roomId: "123",
      clubId: "45",
      roomVersion: "2",
      playerName: "小明",
      expireAt: 1_792_128_660,
      isMine: false,
    });
  });

  it.each([
    ["roomId", { ...invitePayload, roomId: null }],
    ["clubId", { ...invitePayload, clubId: undefined }],
    ["roomVersion", { ...invitePayload, roomVersion: null }],
  ])("drops a dispatchInvite payload missing %s", (_field, payload) => {
    const message: RongSdkMessage = {
      messageUId: "cs-broken",
      messageIdentifier: "RC:CustomMsg",
      fields: { name: "dispatchInvite", data: JSON.stringify(payload) },
      direction: 1,
    };
    expect(mapRongMessage(message, enums)).toBeNull();
  });

  it("derives the conversation preview for every message kind", () => {
    expect(messagePreview({ id: "1", kind: "text", text: "hi", time: "", isMine: true })).toBe("hi");
    expect(messagePreview({ id: "1", kind: "image", imageUrl: "u", time: "", isMine: true })).toBe("[图片]");
    expect(messagePreview({ id: "1", kind: "roomInvite", roomId: "1", roomVersion: "1", time: "", isMine: true })).toBe("[语聊房邀请]");
    expect(messagePreview({ id: "1", kind: "afterSale", title: "售后申请", payload: {}, time: "", isMine: true })).toBe("售后申请");
    expect(messagePreview({ id: "1", kind: "orderNotify", title: "订单已接单", time: "", isMine: true })).toBe("订单已接单");
    expect(messagePreview({
      id: "1", kind: "csInvite", roomId: "1", clubId: "2", roomVersion: "3", time: "", isMine: false,
    })).toBe("[接待邀请]");
  });
});
