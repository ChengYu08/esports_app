import { describe, expect, it, vi } from "vitest";

import { latestMessagePreview, mapRongMessage } from "./chat-message";
import { toManagedMessage } from "./rongcloud-im";

vi.mock("@/core/logging/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn() },
}));
vi.mock("@/core/config/env", () => ({
  env: { apiBaseUrl: "https://example.com" },
}));
// 隔离 rongcloud-im → image-compat → expo-file-system/react-native 的原生依赖链
vi.mock("@/shared/media-picker/image-compat", () => ({
  isGifImage: vi.fn(() => false),
}));

describe("mapRongMessage", () => {
  it("maps a RongCloud image message to a renderable chat image", () => {
    expect(
      mapRongMessage(
        {
          messageType: 4,
          messageUId: "image-1",
          mediaUrl: "https://cdn.example.com/chat/image-1.jpg",
          sentTime: new Date("2026-10-08T10:30:00").getTime(),
          direction: 0,
        },
        { image: 4, send: 0 },
      ),
    ).toEqual({
      id: "image-1",
      kind: "image",
      imageUrl: "https://cdn.example.com/chat/image-1.jpg",
      time: "10:30",
      isMine: true,
    });
  });

  it("接收的图片消息优先使用远端 URL（localPath 是发送方设备上的路径）", () => {
    expect(
      mapRongMessage(
        {
          messageType: 4,
          messageUId: "image-received-1",
          local:
            "file:///data/user/0/cn.panzhi.esports/cache/Manipulator/sender.jpg",
          remote: "https://cdn.example.com/chat/image-received-1.jpg",
          sentTime: new Date("2026-11-06T10:30:00").getTime(),
          direction: 1,
        },
        { image: 4, send: 0 },
      ),
    ).toEqual({
      id: "image-received-1",
      kind: "image",
      imageUrl: "https://cdn.example.com/chat/image-received-1.jpg",
      time: "10:30",
      isMine: false,
    });
  });

  it("自己发出的图片消息仍优先使用本地路径", () => {
    expect(
      mapRongMessage(
        {
          messageType: 4,
          messageUId: "image-sent-1",
          local:
            "file:///data/user/0/cn.panzhi.esports/cache/Manipulator/mine.jpg",
          remote: "https://cdn.example.com/chat/image-sent-1.jpg",
          sentTime: new Date("2026-11-06T10:30:00").getTime(),
          direction: 0,
        },
        { image: 4, send: 0 },
      ),
    ).toEqual({
      id: "image-sent-1",
      kind: "image",
      imageUrl:
        "file:///data/user/0/cn.panzhi.esports/cache/Manipulator/mine.jpg",
      time: "10:30",
      isMine: true,
    });
  });

  it("maps a received RongCloud text message", () => {
    expect(
      mapRongMessage(
        {
          messageType: 1,
          messageUId: "text-1",
          text: "hello",
          sentTime: new Date("2026-10-08T10:30:00").getTime(),
          direction: 1,
        },
        { image: 4, send: 0 },
      ),
    ).toEqual({
      id: "text-1",
      kind: "text",
      text: "hello",
      time: "10:30",
      isMine: false,
    });
  });

  it("maps an ORDER_NOTIFY custom message to a renderable order notification card", () => {
    expect(
      mapRongMessage(
        {
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
        },
        { image: 4, send: 0 },
      ),
    ).toEqual({
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

  it("maps the server-persisted RC:CustomMsg shape used by the PC client", () => {
    expect(
      mapRongMessage(
        {
          messageType: 13,
          messageUId: "order-notify-persisted-1",
          messageIdentifier: "RC:CustomMsg",
          fields: {
            name: "ORDER_NOTIFY",
            data: JSON.stringify({
              title: "大神已接单~",
              orderNo: "PZ20261008002",
              gameName: "无畏契约",
              serviceDesc: "排位上分",
              numDesc: "1局",
              totalPriceDesc: "68",
              createTime: "2026-10-08T11:30:00",
            }),
          },
          sentTime: new Date("2026-10-08T11:30:00").getTime(),
          direction: 1,
        },
        { image: 4, send: 0 },
      ),
    ).toMatchObject({
      id: "order-notify-persisted-1",
      kind: "orderNotify",
      title: "大神已接单~",
      orderNo: "PZ20261008002",
      gameName: "无畏契约",
      isMine: false,
    });
  });

  it("maps the PC-compatible after-sale custom message with its full order payload", () => {
    expect(
      mapRongMessage(
        {
          messageUId: "after-sale-1",
          identifier: "PZAfterSaleApply",
          fields: {
            data: JSON.stringify({
              orderId: 123,
              orderNo: "PZ20261008001",
              companionUserId: 456,
              companionNickname: "大神小王",
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
        },
        { image: 4, send: 0 },
      ),
    ).toEqual({
      id: "after-sale-1",
      kind: "afterSale",
      title: "订单服务不满意，申请售后～",
      payload: {
        orderId: 123,
        orderNo: "PZ20261008001",
        companionUserId: 456,
        companionNickname: "大神小王",
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
    expect(
      toManagedMessage(
        {
          messageUId: "m-1",
          text: "hello",
          direction: 0,
          sentTime: 1000,
        },
        {
          imageType: 4,
          directionSend: 0,
          conversationType: 1,
          timeBefore: 0,
          localRemote: 2,
        },
      ),
    ).toMatchObject({
      id: "m-1",
      text: "hello",
      isMine: true,
      status: "sent",
      sentAt: 1000,
    });
  });
});

describe("latestMessagePreview", () => {
  it("取 sentTime 最新的一条生成预览和时间", () => {
    const messages = [
      {
        messageUId: "old",
        text: "旧消息",
        sentTime: new Date("2026-10-08T09:00:00").getTime(),
        direction: 1,
      },
      {
        messageUId: "new",
        text: "最新消息",
        sentTime: new Date("2026-10-08T10:30:00").getTime(),
        direction: 1,
      },
      {
        messageUId: "mid",
        text: "中间消息",
        sentTime: new Date("2026-10-08T10:00:00").getTime(),
        direction: 1,
      },
    ];
    expect(latestMessagePreview(messages, { image: 4, send: 0 })).toEqual({
      preview: "最新消息",
      time: "10:30",
    });
  });

  it("图片消息预览为 [图片]", () => {
    const messages = [
      {
        messageUId: "img",
        messageType: 4,
        mediaUrl: "https://cdn.example.com/a.jpg",
        sentTime: new Date("2026-10-08T10:30:00").getTime(),
        direction: 0,
      },
    ];
    expect(latestMessagePreview(messages, { image: 4, send: 0 })).toEqual({
      preview: "[图片]",
      time: "10:30",
    });
  });

  it("空数组返回 null", () => {
    expect(latestMessagePreview([], { image: 4, send: 0 })).toBeNull();
  });

  it("最新一条不可映射（如命令消息）返回 null", () => {
    const messages = [
      {
        messageUId: "cmd",
        messageType: 0,
        sentTime: new Date("2026-10-08T10:30:00").getTime(),
        direction: 1,
      },
    ];
    expect(latestMessagePreview(messages, { image: 4, send: 0 })).toBeNull();
  });
});
