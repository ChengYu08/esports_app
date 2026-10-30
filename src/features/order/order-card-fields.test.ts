import { createRequire } from "node:module";
import { expect, it, vi } from "vitest";

vi.mock("@/core/network/api-client", () => ({ apiClient: vi.fn() }));
// 字段映射测试只需要图片资源句柄，无需加载原生图片。
const require = createRequire(import.meta.url);
require.extensions[".svg"] = (module) => { module.exports = 1; };
const { mapOrder } = await import("./order.api");

it.each([
  [{ gameModeName: "排位", gameLevelName: "钻石", serviceName: "陪练", title: "旧标题" }, "排位-钻石-陪练"],
  [{ gameModeName: " 排位 ", gameLevelName: " ", serviceName: " 陪练 " }, "排位-陪练"],
  [{ serviceName: "陪练" }, "陪练"],
  [{ gameModeName: "排位", gameLevelName: "钻石" }, "排位-钻石"],
  [{ title: "历史订单服务" }, "历史订单服务"],
  [{ productName: "历史商品" }, "历史商品"],
  [{}, "陪玩服务"],
])("服务按模式、等级、服务排列，并兼容缺失字段：%j", (fields, expected) => {
  expect(mapOrder(fields, 0, "place").serviceName).toBe(expected);
  expect(mapOrder(fields, 0, "accept").serviceName).toBe(expected);
});

it("下单侧展示陪玩和俱乐部，接单侧展示老板，并保留完整订单字段", () => {
  const fields = {
    id: 42,
    orderNo: "ORDER-42",
    orderStatus: "ACCEPTED",
    buyerNickname: "老板昵称",
    buyerHeadImage: "https://example.com/buyer.png",
    receiverNickname: "陪玩昵称",
    receiverHeadImage: "https://example.com/companion.png",
    companionClubName: "陪玩俱乐部",
    gameName: "王者荣耀",
    gameModeName: "排位",
    gameLevelName: "钻石",
    serviceName: "陪练",
    unitPrice: 100,
    quantity: 2,
    billingUnitName: "局",
    realPayAmount: 200,
    createTime: "2026-10-30T10:00:00",
    remark: "订单备注",
  };
  const place = mapOrder(fields, 0, "place");
  const accept = mapOrder(fields, 0, "accept");

  expect(place).toMatchObject({
    sellerName: "陪玩昵称",
    sellerAvatar: fields.receiverHeadImage,
    clubName: "陪玩俱乐部",
  });
  expect(accept).toMatchObject({
    sellerName: "老板昵称",
    sellerAvatar: fields.buyerHeadImage,
    clubName: undefined,
  });
  for (const order of [place, accept]) {
    expect(order).toMatchObject({
      orderNo: "ORDER-42",
      gameName: "王者荣耀",
      serviceName: "排位-钻石-陪练",
      unitPrice: "100",
      quantity: 2,
      billingUnitName: "局",
      totalPrice: "200",
      createTime: fields.createTime,
      remark: "订单备注",
    });
  }
});
