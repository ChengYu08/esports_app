import { createRequire } from "node:module";
import { afterEach, expect, it, vi } from "vitest";

import { apiClient } from "@/core/network/api-client";
import { queryClient } from "@/core/query/query-client";
import { computeFreeSubmitAmount, computeOrderPayableStars, formatOrderFreeSummary } from "./free-amount";
import { filterOrders } from "./order.filter";

vi.mock("@/core/network/api-client", () => ({ apiClient: vi.fn() }));
// 原生图片在金额映射测试中只需要保留资源句柄。
const require = createRequire(import.meta.url);
require.extensions[".svg"] = (module) => { module.exports = 1; };
const { mapOrder, freeOrderService } = await import("./order.api");
const { refreshOrderAfterAction } = await import("./order-query");

afterEach(() => {
  queryClient.clear();
  vi.clearAllMocks();
});

const partialFreeOrder = {
  id: 42,
  orderStatus: "PARTIAL_REFUNDED",
  realPayAmount: 940,
  price: 470,
  quantity: 2,
  billingUnitName: "小时",
  isFreeOrder: true,
  refundAmount: 470,
};

it("部分免单同时保留原价与免单后的应收金额", () => {
  const order = mapOrder({ id: 42, orderStatus: "IN_SERVICE", realPayAmount: 800, isFreeOrder: true, refundAmount: 200 }, 0, "accept");
  expect(order.totalPrice).toBe("800");
  expect(order.freeAmount).toBe("200");
  expect(computeOrderPayableStars(order)).toBe(600);
});

it("全额免单后的零金额不会回退到原价", () => {
  const order = mapOrder({ id: 42, orderStatus: "REFUNDED", realPayAmount: 800, isFreeOrder: true, refundAmount: 800 }, 0, "accept");
  expect(computeOrderPayableStars(order)).toBe(0);
});

it("取消订单的退款不显示为陪玩免单", () => {
  const order = mapOrder({ id: 42, orderStatus: "CANCELED", realPayAmount: 800, refundAmount: 800 }, 0, "accept");
  expect(order.freeAmount).toBeUndefined();
  expect(computeOrderPayableStars(order)).toBe(800);
});

it("免单一小时后展示免单时长、剩余金额与部分免单状态，不再显示待支付", () => {
  const accept = mapOrder(partialFreeOrder, 0, "accept");
  const place = mapOrder(partialFreeOrder, 0, "place");
  for (const order of [accept, place]) {
    expect(order.status).toBe("partiallyRefunded");
    expect(order.statusLabel).toBe("部分免单");
    expect(order.quantity).toBe(2);
    expect(formatOrderFreeSummary(order)).toBe("1小时（470星钻）");
    expect(computeOrderPayableStars(order)).toBe(470);
    expect(order.actions.some(({ key }) => ["pay", "free", "start", "complete"].includes(key))).toBe(false);
    expect(filterOrders([order], "completed")).toEqual([order]);
    expect(filterOrders([order], "inProgress")).toEqual([]);
    expect(filterOrders([order], "cancelled")).toEqual([]);
  }
  expect(place.actions.map(({ key }) => key)).toEqual(["afterSales", "review", "reorder"]);
});

it("一小时订单全额免单显示已免单及零应收，并归入已取消列表", () => {
  const order = mapOrder({ ...partialFreeOrder, orderStatus: "REFUNDED", quantity: 1, realPayAmount: 470 }, 0, "accept");
  expect(order.statusLabel).toBe("已免单");
  expect(formatOrderFreeSummary(order)).toBe("1小时（470星钻）");
  expect(computeOrderPayableStars(order)).toBe(0);
  expect(filterOrders([order], "cancelled")).toEqual([order]);
  expect(order.actions).toEqual([]);
});

it("普通部分退款使用退款文案，不冒充免单", () => {
  const order = mapOrder({ ...partialFreeOrder, isFreeOrder: false });
  expect(order.statusLabel).toBe("部分退款");
  expect(formatOrderFreeSummary(order)).toBeUndefined();
});

it("活动订单透传 productId/activityId/discountAmount/refundBaseAmount 与实付金额", () => {
  const order = mapOrder(
    { id: 42, orderStatus: "PAID", totalPrice: 900, realPayAmount: 800, productId: 11, activityId: 22, discountAmount: 100, refundBaseAmount: 900 },
    0,
    "place",
  );
  expect(order.productId).toBe(11);
  expect(order.activityId).toBe(22);
  expect(order.discountAmount).toBe(100);
  expect(order.refundBaseAmount).toBe(900);
  expect(order.realPayAmount).toBe("800");
});

it("普通订单不输出活动字段，金额展示保持不变", () => {
  const order = mapOrder({ id: 42, orderStatus: "PAID", totalPrice: 500 }, 0, "place");
  expect(order.productId).toBeUndefined();
  expect(order.activityId).toBeUndefined();
  expect(order.discountAmount).toBeUndefined();
  expect(order.refundBaseAmount).toBeUndefined();
  expect(order.realPayAmount).toBeUndefined();
  expect(order.totalPrice).toBe("500");
});

it("金额视角：买家合计取实付金额，陪玩合计取订单总价", () => {
  const raw = { id: 42, orderStatus: "PAID", totalPrice: 900, realPayAmount: 800 };
  expect(mapOrder(raw, 0, "place").totalPrice).toBe("800");
  expect(mapOrder(raw, 0, "accept").totalPrice).toBe("900");
  // 普通订单只有总价时两个视角都回落到总价，行为不变
  expect(mapOrder({ id: 42, orderStatus: "PAID", totalPrice: 500 }, 0, "accept").totalPrice).toBe("500");
});

it("免单提交口径：活动订单按原价退款基数折算，普通订单维持时长×单价计算值", () => {
  // 活动订单全额免单：freeAmount 即 refundBaseAmount
  const activity = { quantity: 2, refundBaseAmount: 900 };
  expect(computeFreeSubmitAmount(activity, 470, 2)).toBe(900);
  // 活动订单部分免单：按免单时长占比折算原价基数
  expect(computeFreeSubmitAmount(activity, 470, 1)).toBe(450);
  // 普通订单无 refundBaseAmount：维持现有计算值，行为不变
  expect(computeFreeSubmitAmount({ quantity: 2 }, 470, 1)).toBe(470);
});

it("最终确认免单向真实业务接口提交星钻金额，失败时向上抛出", async () => {
  vi.mocked(apiClient).mockResolvedValueOnce({ code: "SUCCESS" });
  await freeOrderService("42", 470, "order-token");
  expect(apiClient).toHaveBeenCalledWith("/client/v1/order/free", {
    method: "POST",
    token: "order-token",
    body: { action: { orderId: 42, freeAmount: 470, actionType: "COMPANION_FREE", reason: "陪玩服务免单" } },
  });
  vi.mocked(apiClient).mockResolvedValueOnce({ code: "FAIL", info: "订单已结账，无法免单" });
  await expect(freeOrderService("42", 470, "order-token")).rejects.toThrow("订单已结账，无法免单");
});

it("免单后以详情替换列表缓存，部分免单留在已完成，不会误归到待支付", async () => {
  const stale = mapOrder({ ...partialFreeOrder, orderStatus: "COMPLETED", isFreeOrder: false, refundAmount: 0 }, 0, "accept");
  const finishedKey = ["orders", "accept", "completed", "51"];
  const progressKey = ["orders", "accept", "inProgress", "51"];
  const otherAccountKey = ["orders", "accept", "completed", "other"];
  const cached = { pages: [{ items: [stale], hasMore: false }], pageParams: [1] };
  queryClient.setQueryData(finishedKey, cached);
  queryClient.setQueryData(progressKey, cached);
  queryClient.setQueryData(otherAccountKey, cached);
  vi.mocked(apiClient).mockResolvedValueOnce({ code: "SUCCESS", data: partialFreeOrder });

  await refreshOrderAfterAction("42", "order-token", "51");

  const finished = queryClient.getQueryData<typeof cached>(finishedKey)!;
  expect(finished.pages[0].items[0].status).toBe("partiallyRefunded");
  expect(finished.pages[0].items[0].freeAmount).toBe("470");
  expect(queryClient.getQueryData<typeof cached>(progressKey)?.pages[0].items).toEqual([]);
  expect(queryClient.getQueryData(otherAccountKey)).toEqual(cached);
});
