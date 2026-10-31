import { afterEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/core/network/api-client";

import {
  fetchPayPreview,
  fetchQuickMatchDetail,
  selectAndCreateOrder,
} from "./match.api";

vi.mock("@/core/network/api-client", () => ({ apiClient: vi.fn() }));

afterEach(() => vi.clearAllMocks());

describe("快速匹配详情：活动字段透传", () => {
  it("活动需求映射活动字段（activityId 转字符串、activityCode/文案 trim、金额转数字）", async () => {
    vi.mocked(apiClient).mockResolvedValue({
      code: "SUCCESS",
      data: {
        requestNo: "QM1",
        publishSource: "ACTIVITY",
        activityId: 10086,
        activityCode: " SECKILL001 ",
        activityType: " SECKILL ",
        cardItems: [
          { label: " 活动名称 ", value: { text: " 电竞陪玩秒杀 " } },
          { label: "活动价", value: { text: "9.9 星钻/小时" } },
        ],
        discountAmount: "5.00",
        realPayAmount: "9.9",
        maxSelectableCount: "1",
      },
    });

    const result = await fetchQuickMatchDetail("QM1", "token");

    expect(apiClient).toHaveBeenCalledWith(
      "/client/v1/quickMatch/detail?requestNo=QM1",
      { method: "GET", token: "token", signal: undefined },
    );
    expect(result.activityId).toBe("10086");
    expect(result.activityCode).toBe("SECKILL001");
    expect(result.activityType).toBe("SECKILL");
    expect(result.publishSource).toBe("ACTIVITY");
    expect(result.cardItems).toEqual([
      { label: "活动名称", value: { text: "电竞陪玩秒杀" } },
      { label: "活动价", value: { text: "9.9 星钻/小时" } },
    ]);
    expect(result.discountAmount).toBe(5);
    expect(result.realPayAmount).toBe(9.9);
    expect(result.maxSelectableCount).toBe(1);
  });

  it("普通需求不输出活动字段（activityCode 为空 → undefined）", async () => {
    vi.mocked(apiClient).mockResolvedValue({
      code: "SUCCESS",
      data: {
        requestNo: "QM2",
        activityCode: "",
        cardItems: [],
        maxSelectableCount: null as unknown as number,
        discountAmount: null as unknown as number,
      },
    });

    const result = await fetchQuickMatchDetail("QM2", "token");

    expect(result.activityId).toBeUndefined();
    expect(result.activityCode).toBeUndefined();
    expect(result.activityType).toBeUndefined();
    expect(result.publishSource).toBeUndefined();
    expect(result.cardItems).toEqual([]);
    expect(result.maxSelectableCount).toBeUndefined();
    expect(result.discountAmount).toBeUndefined();
    expect(result.realPayAmount).toBeUndefined();
  });

  it("信封业务失败时抛出后端 info", async () => {
    vi.mocked(apiClient).mockResolvedValue({ code: "FAILED", info: "需求不存在" });

    await expect(fetchQuickMatchDetail("QM1", "token")).rejects.toThrow("需求不存在");
  });
});

describe("selectAndCreateOrder：活动模式透传 activityId", () => {
  it("活动模式请求 action 带 activityId（字符串透传），响应金额透传", async () => {
    vi.mocked(apiClient).mockResolvedValue({
      code: "SUCCESS",
      data: {
        totalPrice: "9.9",
        discountAmount: 5,
        realPayAmount: 4.9,
        orders: [{ orderId: 8001, serviceUserId: 2001 }],
      },
    });

    const result = await selectAndCreateOrder("QM1", ["101"], "token", {
      activityId: "10086",
    });

    expect(apiClient).toHaveBeenCalledWith("/client/v1/quickMatch/selectAndCreateOrder", {
      method: "POST",
      token: "token",
      body: {
        action: { requestNo: "QM1", grabIds: ["101"], activityId: "10086" },
      },
    });
    expect(result).toEqual({
      totalPrice: 9.9,
      discountAmount: 5,
      realPayAmount: 4.9,
      orders: [{ orderId: "8001", serviceUserId: "2001" }],
    });
  });

  it("普通模式请求不带 activityId，行为不变", async () => {
    vi.mocked(apiClient).mockResolvedValue({
      code: "SUCCESS",
      data: { totalPrice: 20, orders: [{ orderId: "8002" }] },
    });

    const result = await selectAndCreateOrder("QM2", ["102", "103"], "token");

    expect(apiClient).toHaveBeenCalledWith("/client/v1/quickMatch/selectAndCreateOrder", {
      method: "POST",
      token: "token",
      body: { action: { requestNo: "QM2", grabIds: ["102", "103"] } },
    });
    expect(result).toEqual({
      totalPrice: 20,
      discountAmount: undefined,
      realPayAmount: undefined,
      orders: [{ orderId: "8002" }],
    });
  });
});

describe("fetchPayPreview（仅活动订单调用）", () => {
  it("请求体 {action:{requestNo, grabIds, paymentMethodCode:'DIAMOND'}}，映射金额与优惠券", async () => {
    vi.mocked(apiClient).mockResolvedValue({
      code: "SUCCESS",
      data: {
        totalPrice: "9.9",
        paymentMethods: [
          {
            code: "DIAMOND",
            name: "星钻",
            balance: "3",
            discountAmount: "5.00",
            payableAmount: 4.9,
            coupons: [
              { userCouponId: 9001, couponName: "新人立减券", discountAmount: "5" },
            ],
          },
        ],
      },
    });

    const preview = await fetchPayPreview("QM1", ["101", "102"], "token");

    expect(apiClient).toHaveBeenCalledWith("/client/v1/pay/preview", {
      method: "POST",
      token: "token",
      signal: undefined,
      body: {
        action: {
          requestNo: "QM1",
          grabIds: [101, 102],
          paymentMethodCode: "DIAMOND",
        },
      },
    });
    expect(preview.totalPrice).toBe(9.9);
    expect(preview.paymentMethods).toEqual([
      {
        code: "DIAMOND",
        name: "星钻",
        balance: 3,
        discountAmount: 5,
        payableAmount: 4.9,
        coupons: [
          { userCouponId: "9001", couponName: "新人立减券", discountAmount: 5 },
        ],
      },
    ]);
  });

  it("信封业务失败时抛出后端 info", async () => {
    vi.mocked(apiClient).mockResolvedValue({ code: "FAILED", info: "支付预览失败" });

    await expect(fetchPayPreview("QM1", ["101"], "token")).rejects.toThrow("支付预览失败");
  });
});
