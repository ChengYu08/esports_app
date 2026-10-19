import { describe, expect, it } from "vitest";

import { mapRongMessage, type RongSdkMessage } from "./chat-message";

const enums = { image: 4, send: 0 };

describe("server system notifications", () => {
  it.each([
    { messageIdentifier: "RC:CustomMsg", fields: { name: "TEXT_NOTIFY_MSG", data: JSON.stringify({ content: "您的实名认证已通过" }) } },
    { objectName: "RC:CustomMsg", rawData: JSON.stringify({ name: "TEXT_NOTIFY_MSG", data: JSON.stringify({ content: "您的实名认证已通过" }) }) },
  ])("renders platform notification content from the native SDK: %j", (body) => {
    const message: RongSdkMessage = { ...body, messageUId: "platform-1", direction: 1 };
    expect(mapRongMessage(message, enums)).toMatchObject({
      id: "platform-1", kind: "text", text: "您的实名认证已通过", isMine: false,
    });
  });

  it("recovers order cards returned as unknown messages by an older native session", () => {
    const message = {
      messageUId: "order-raw-1",
      objectName: "RC:CustomMsg",
      rawData: JSON.stringify({
        name: "ORDER_NOTIFY",
        data: JSON.stringify({ title: "订单已接单", orderNo: "PZ20261016001", gameName: "王者荣耀" }),
      }),
      direction: 1,
    };
    expect(mapRongMessage(message, enums)).toMatchObject({
      id: "order-raw-1", kind: "orderNotify", title: "订单已接单",
      orderNo: "PZ20261016001", gameName: "王者荣耀", isMine: false,
    });
  });

  it("does not turn transient command messages into chat notifications", () => {
    const message = {
      objectName: "RC:CmdMsg",
      rawData: JSON.stringify({ name: "ORDER_NOTIFY", data: JSON.stringify({ title: "订单已支付" }) }),
    };
    expect(mapRongMessage(message, enums)).toBeNull();
  });

  it("ignores malformed custom payloads without throwing", () => {
    const message = { objectName: "RC:CustomMsg", rawData: "{broken" };
    expect(mapRongMessage(message, enums)).toBeNull();
  });
});

describe("order assistant history messages", () => {
  it("maps a persisted RongCloud custom order notification", () => {
    const message = mapRongMessage({
      messageType: 13,
      messageUId: "order-history-1",
      messageIdentifier: "RC:CustomMsg",
      fields: {
        name: "ORDER_NOTIFY",
        data: JSON.stringify({ title: "订单已接单", orderNo: "PZ20261016001" }),
      },
      sentTime: 1_792_128_600_000,
      direction: 1,
    }, { image: 4, send: 0 });

    expect(message).toMatchObject({
      id: "order-history-1",
      kind: "orderNotify",
      title: "订单已接单",
      orderNo: "PZ20261016001",
      isMine: false,
    });
  });
});
