import { afterEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/core/network/api-client";

import {
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

describe("selectAndCreateOrder：请求只带 requestNo 与 grabIds", () => {
  it("请求 action 不携带活动 ID（活动归属由后端按 requestNo 反查），响应金额透传", async () => {
    vi.mocked(apiClient).mockResolvedValue({
      code: "SUCCESS",
      data: {
        totalPrice: "9.9",
        discountAmount: 5,
        realPayAmount: 4.9,
        orders: [{ orderId: 8001, serviceUserId: 2001 }],
      },
    });

    const result = await selectAndCreateOrder("QM1", ["101"], "token");

    expect(apiClient).toHaveBeenCalledWith("/client/v1/quickMatch/selectAndCreateOrder", {
      method: "POST",
      token: "token",
      body: {
        action: { requestNo: "QM1", grabIds: ["101"] },
      },
    });
    expect(result).toEqual({
      totalPrice: 9.9,
      discountAmount: 5,
      realPayAmount: 4.9,
      orders: [{ orderId: "8001", serviceUserId: "2001" }],
    });
  });

  it("多选普通模式请求结构不变", async () => {
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
