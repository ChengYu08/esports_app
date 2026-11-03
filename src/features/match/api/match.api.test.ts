import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  apiResponse: null as Record<string, unknown> | null,
}));

vi.mock("@/core/network/api-client", () => ({
  apiClient: vi.fn(async () => mocks.apiResponse),
}));

const { batchPayQuickMatch, fetchQuickMatchPaymentPreview, StarNotEnoughError } =
  await import("./match.api");
const { apiClient } = await import("@/core/network/api-client");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.apiResponse = null;
});

describe("fetchQuickMatchPaymentPreview", () => {
  it("映射 totalPrice 与 paymentMethods 金额字段", async () => {
    mocks.apiResponse = {
      code: "SUCCESS",
      data: {
        totalPrice: "100",
        paymentMethods: [
          {
            code: "DIAMOND",
            name: "钻石",
            balance: "50",
            discountAmount: 10,
            payableAmount: "90",
          },
        ],
      },
    };

    await expect(
      fetchQuickMatchPaymentPreview("QM1", ["g1", "g2"], "token"),
    ).resolves.toEqual({
      totalPrice: 100,
      paymentMethods: [
        {
          code: "DIAMOND",
          name: "钻石",
          balance: 50,
          discountAmount: 10,
          payableAmount: 90,
        },
      ],
    });
    expect(apiClient).toHaveBeenCalledWith("/client/v1/pay/preview", {
      method: "POST",
      token: "token",
      body: { action: { requestNo: "QM1", grabIds: ["g1", "g2"] } },
    });
  });

  it("paymentMethods 缺省时返回空数组", async () => {
    mocks.apiResponse = { code: "SUCCESS", data: { totalPrice: 30 } };

    await expect(
      fetchQuickMatchPaymentPreview("QM1", ["g1"], "token"),
    ).resolves.toEqual({
      totalPrice: 30,
      paymentMethods: [],
    });
  });

  it("非成功包络抛出服务端 info", async () => {
    mocks.apiResponse = { code: "FAIL", info: "需求已结束" };

    await expect(
      fetchQuickMatchPaymentPreview("QM1", ["g1"], "token"),
    ).rejects.toThrow("需求已结束");
  });
});

describe("batchPayQuickMatch", () => {
  it("STAR_NOT_ENOUGH 抛出 StarNotEnoughError", async () => {
    mocks.apiResponse = { code: "STAR_NOT_ENOUGH", info: "钻石余额不足" };

    const error = await batchPayQuickMatch("QM1", "token").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(StarNotEnoughError);
    expect((error as Error).message).toBe("钻石余额不足");
  });

  it("SUCCESS 正常返回", async () => {
    mocks.apiResponse = { code: "SUCCESS" };

    await expect(batchPayQuickMatch("QM1", "token")).resolves.toBeUndefined();
  });

  it("其他失败抛出 info 或兜底文案", async () => {
    mocks.apiResponse = { code: "FAIL", info: "订单状态已变化" };
    await expect(batchPayQuickMatch("QM1", "token")).rejects.toThrow("订单状态已变化");

    mocks.apiResponse = { code: "FAIL" };
    await expect(batchPayQuickMatch("QM1", "token")).rejects.toThrow("支付失败");
  });
});
