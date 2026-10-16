import { describe, expect, it } from "vitest";

import { mapRongMessage } from "./chat-message";

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
