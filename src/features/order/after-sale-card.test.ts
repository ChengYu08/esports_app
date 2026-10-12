import { describe, expect, it } from "vitest";

import { afterSaleCardRows, buildAfterSalePayload } from "./after-sale-card";

describe("after-sale card", () => {
  it("formats card rows in PC order and hides empty values", () => {
    expect(afterSaleCardRows({
      companionNickname: "陪玩师小王",
      companionUserId: 456,
      orderNo: "PZ20261008001",
      gameName: "王者荣耀",
      serviceDesc: "排位上分",
      unitPrice: 68,
      quantity: 2,
      totalPrice: 136,
      createTime: "2026-10-08T10:30:00",
      remark: "尽快安排",
    })).toEqual([
      { label: "陪玩师", value: "陪玩师小王（ID：456）" },
      { label: "订单号", value: "PZ20261008001" },
      { label: "游戏", value: "王者荣耀" },
      { label: "服务", value: "排位上分 68星钻/小时" },
      { label: "数量", value: "2小时" },
      { label: "总价", value: "136星钻" },
      { label: "时间", value: "2026-10-08 10:30:00" },
      { label: "备注", value: "尽快安排" },
    ]);
  });

  it("builds the same payload from an order for both order entry points", () => {
    expect(buildAfterSalePayload({
      id: "123",
      orderNo: "PZ123",
      receiverUserId: "456",
      sellerName: "陪玩师小王",
      gameName: "王者荣耀",
      serviceName: "排位上分",
      unitPrice: "68",
      quantity: 2,
      totalPrice: "136",
      createTime: "2026-10-08T10:30:00",
      remark: "尽快安排",
      clubId: 789,
    }, 999)).toEqual({
      orderId: 123,
      orderNo: "PZ123",
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
    });
  });
});
