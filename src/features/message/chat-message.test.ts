import { describe, expect, it } from "vitest";

import { mapRongMessage } from "./chat-message";
import { toManagedMessage } from "./rongcloud-im";

describe("mapRongMessage", () => {
  it("maps a RongCloud image message to a renderable chat image", () => {
    expect(mapRongMessage({
      messageType: 4,
      messageUId: "image-1",
      mediaUrl: "https://cdn.example.com/chat/image-1.jpg",
      sentTime: new Date("2026-10-08T10:30:00").getTime(),
      direction: 0,
    }, { image: 4, send: 0 })).toEqual({
      id: "image-1",
      kind: "image",
      imageUrl: "https://cdn.example.com/chat/image-1.jpg",
      time: "10:30",
      isMine: true,
    });
  });

  it("maps a received RongCloud text message", () => {
    expect(mapRongMessage({
      messageType: 1,
      messageUId: "text-1",
      text: "hello",
      sentTime: new Date("2026-10-08T10:30:00").getTime(),
      direction: 1,
    }, { image: 4, send: 0 })).toEqual({
      id: "text-1",
      kind: "text",
      text: "hello",
      time: "10:30",
      isMine: false,
    });
  });

  it("maps an ORDER_NOTIFY custom message to a renderable order notification card", () => {
    expect(mapRongMessage({
      messageUId: "order-notify-1",
      identifier: "ORDER_NOTIFY",
      fields: {
        data: JSON.stringify({
          title: "您的订单已被接单",
          orderNo: "PZ20261008001",
          gameName: "王者荣耀",
          serviceDesc: "排位上分",
          numDesc: "2局",
          totalPriceDesc: "¥68.00",
          createTime: "2026-10-08T10:30:00",
        }),
      },
      sentTime: new Date("2026-10-08T10:30:00").getTime(),
      direction: 1,
    }, { image: 4, send: 0 })).toEqual({
      id: "order-notify-1",
      kind: "orderNotify",
      title: "您的订单已被接单",
      orderNo: "PZ20261008001",
      gameName: "王者荣耀",
      serviceDesc: "排位上分",
      numDesc: "2局",
      totalPriceDesc: "¥68.00",
      createTime: "2026-10-08T10:30:00",
      time: "10:30",
      isMine: false,
    });
  });

  it("maps the PC-compatible after-sale custom message with its full order payload", () => {
    expect(mapRongMessage({
      messageUId: "after-sale-1",
      identifier: "PZAfterSaleApply",
      fields: {
        data: JSON.stringify({
          orderId: 123,
          orderNo: "PZ20261008001",
          companionUserId: 456,
          companionNickname: "陪玩师小王",
          gameName: "王者荣耀",
          serviceDesc: "排位上分",
          unitPrice: 68,
          quantity: 2,
          totalPrice: 136,
          createTime: "2026-10-08T10:30:00",
          remark: "尽快安排",
          clubId: 789,
          csUserId: 999,
        }),
      },
      sentTime: new Date("2026-10-08T10:30:00").getTime(),
      direction: 1,
    }, { image: 4, send: 0 })).toEqual({
      id: "after-sale-1",
      kind: "afterSale",
      title: "订单服务不满意，申请售后～",
      payload: {
        orderId: 123,
        orderNo: "PZ20261008001",
        companionUserId: 456,
        companionNickname: "陪玩师小王",
        gameName: "王者荣耀",
        serviceDesc: "排位上分",
        unitPrice: 68,
        quantity: 2,
        totalPrice: 136,
        createTime: "2026-10-08T10:30:00",
        remark: "尽快安排",
        clubId: 789,
        csUserId: 999,
      },
      time: "10:30",
      isMine: false,
    });
  });

  it("keeps the SDK ID and timestamp in a confirmed outgoing message", () => {
    expect(toManagedMessage({
      messageUId: "m-1",
      text: "hello",
      direction: 0,
      sentTime: 1000,
    }, { imageType: 4, directionSend: 0, conversationType: 1, timeBefore: 0, localRemote: 2 })).toMatchObject({ id: "m-1", text: "hello", isMine: true, status: "sent", sentAt: 1000 });
  });
});
