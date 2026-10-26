import { describe, expect, it } from "vitest";

import {
  KNOWN_RONG_COMMAND_NAMES,
  parseOrderNotifyPopup,
  parseQuickMatchExpired,
  parseQuickMatchNotice,
} from "./rongcloud-commands";

describe("parseQuickMatchNotice", () => {
  it("解析完整 payload", () => {
    const payload = parseQuickMatchNotice({
      commandName: "QUICK_MATCH_NOTICE",
      requestNo: "QM20261020001",
      buyerNickname: "老板A",
      gameName: "王者荣耀",
      modeName: "上分",
      levelName: "钻石",
      serviceName: "陪玩",
      expireTime: "2026-10-20 12:30:00",
    });
    expect(payload).toEqual({
      requestNo: "QM20261020001",
      buyerNickname: "老板A",
      gameName: "王者荣耀",
      modeName: "上分",
      levelName: "钻石",
      serviceName: "陪玩",
      expireAtMs: new Date("2026-10-20T12:30:00").getTime(),
    });
  });

  it("expireTime 缺失时 expireAtMs 为 NaN", () => {
    const payload = parseQuickMatchNotice({ requestNo: "QM1" });
    expect(payload?.requestNo).toBe("QM1");
    expect(payload?.expireAtMs).toBeNaN();
  });

  it("缺 requestNo 返回 null", () => {
    expect(parseQuickMatchNotice({ gameName: "王者荣耀" })).toBeNull();
  });

  it("requestNo 空串返回 null", () => {
    expect(parseQuickMatchNotice({ requestNo: "" })).toBeNull();
  });

  it("requestNo 数字转为字符串", () => {
    expect(parseQuickMatchNotice({ requestNo: 123 })?.requestNo).toBe("123");
  });
});

describe("parseQuickMatchExpired", () => {
  it("解析 requestNo", () => {
    expect(parseQuickMatchExpired({ requestNo: "QM1" })).toEqual({ requestNo: "QM1" });
  });

  it.each([[{}], [{ requestNo: "" }]])(
    "缺 requestNo 返回 null",
    (data) => {
      expect(parseQuickMatchExpired(data)).toBeNull();
    },
  );
});

describe("parseOrderNotifyPopup", () => {
  it("解析完整 payload 且 orderId 数字化", () => {
    const payload = parseOrderNotifyPopup({
      commandName: "ORDER_NOTIFY",
      title: "订单支付通知",
      orderId: 12345,
      orderNo: "PZ20261020001",
      buyerNickname: "老板B",
      buyerHeadImage: "https://example.com/a.png",
    });
    expect(payload).toEqual({
      title: "订单支付通知",
      orderId: "12345",
      orderNo: "PZ20261020001",
      buyerNickname: "老板B",
      buyerHeadImage: "https://example.com/a.png",
    });
  });

  it("orderId 字符串数字可解析", () => {
    expect(parseOrderNotifyPopup({ orderId: "678", orderNo: "PZ1" })?.orderId).toBe("678");
  });

  it.each([
    ["orderId 缺失", { orderNo: "PZ1" }],
    ["orderId 非数字", { orderId: "abc", orderNo: "PZ1" }],
    ["orderId 为 0", { orderId: 0, orderNo: "PZ1" }],
    ["orderId 为负数", { orderId: -1, orderNo: "PZ1" }],
    ["orderNo 缺失", { orderId: 1 }],
    ["orderNo 空串", { orderId: 1, orderNo: "" }],
  ])("%s 返回 null", (_name, data) => {
    expect(parseOrderNotifyPopup(data as Record<string, unknown>)).toBeNull();
  });
});

describe("KNOWN_RONG_COMMAND_NAMES", () => {
  it("覆盖后端枚举全部命令名", () => {
    for (const name of [
      "CUSTOMER_SERVICE_INVITE",
      "dispatchInvite",
      "QUICK_MATCH_NOTICE",
      "QUICK_MATCH_EXPIRED",
      "QUICK_MATCH_CANCELLED",
      "QUICK_MATCH_CREATED",
      "TEXT_NOTIFY_MSG",
      "ORDER_NOTIFY",
      "ROOM_KICKED",
    ]) {
      expect(KNOWN_RONG_COMMAND_NAMES.has(name)).toBe(true);
    }
  });
});
