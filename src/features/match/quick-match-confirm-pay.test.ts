import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ConfirmPayState } from "./quick-match-confirm-pay";

const mocks = vi.hoisted(() => {
  class StarNotEnoughError extends Error {
    constructor(message?: string) {
      super(message || "钻石余额不足");
      this.name = "StarNotEnoughError";
    }
  }
  return {
    StarNotEnoughError,
    selectAndCreateOrder: vi.fn(),
    fetchQuickMatchPayable: vi.fn(),
    batchPayQuickMatch: vi.fn(),
  };
});

vi.mock("@/features/match/api/match.api", () => ({
  StarNotEnoughError: mocks.StarNotEnoughError,
  selectAndCreateOrder: mocks.selectAndCreateOrder,
  fetchQuickMatchPayable: mocks.fetchQuickMatchPayable,
  batchPayQuickMatch: mocks.batchPayQuickMatch,
}));

vi.mock("@/shared/ui/app-toast", () => ({ showToast: vi.fn() }));

const { confirmQuickMatchPay } = await import("./quick-match-confirm-pay");
const { showToast } = await import("@/shared/ui/app-toast");

const CREATED_ORDERS = [
  { orderId: "o1", serviceUserId: "u1" },
  { orderId: "o2" },
];

function initialState(overrides: Partial<ConfirmPayState> = {}): ConfirmPayState {
  return {
    ordersCreated: false,
    expectedTotal: 100,
    orders: [],
    ...overrides,
  };
}

function makeDeps(overrides: Record<string, unknown> = {}) {
  return {
    requestNo: "QM1",
    token: "token",
    grabIds: ["g1", "g2"],
    balance: 200,
    selectionMatchesSnapshot: vi.fn(() => true),
    onSelectionChanged: vi.fn(),
    onOrdersCreated: vi.fn(),
    onBalanceInsufficient: vi.fn(),
    onPaid: vi.fn(),
    ...overrides,
  } as Parameters<typeof confirmQuickMatchPay>[1];
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.selectAndCreateOrder.mockResolvedValue({
    totalPrice: 100,
    orders: CREATED_ORDERS,
  });
  mocks.fetchQuickMatchPayable.mockResolvedValue({
    orderCount: 1,
    totalPrice: 100,
  });
  mocks.batchPayQuickMatch.mockResolvedValue(undefined);
});

describe("confirmQuickMatchPay", () => {
  it("建单→payable 一致→批量支付→onPaid 携带订单", async () => {
    const deps = makeDeps();

    const result = await confirmQuickMatchPay(initialState(), deps);

    expect(mocks.selectAndCreateOrder).toHaveBeenCalledWith("QM1", ["g1", "g2"], "token");
    expect(deps.onOrdersCreated).toHaveBeenCalledTimes(1);
    expect(mocks.batchPayQuickMatch).toHaveBeenCalledWith("QM1", "token");
    expect(deps.onPaid).toHaveBeenCalledWith(CREATED_ORDERS);
    expect(result).toEqual({
      ordersCreated: true,
      expectedTotal: 100,
      orders: CREATED_ORDERS,
    });
  });

  it("已建单状态重试支付不再建单", async () => {
    const deps = makeDeps();

    await confirmQuickMatchPay(
      initialState({ ordersCreated: true, orders: CREATED_ORDERS }),
      deps,
    );

    expect(mocks.selectAndCreateOrder).not.toHaveBeenCalled();
    expect(deps.onOrdersCreated).not.toHaveBeenCalled();
    expect(deps.onPaid).toHaveBeenCalledWith(CREATED_ORDERS);
  });

  it("payable 与基线不一致：更新金额、提示、不支付", async () => {
    const deps = makeDeps();
    mocks.fetchQuickMatchPayable.mockResolvedValue({
      orderCount: 1,
      totalPrice: 120,
      realPayAmount: 120,
    });

    const result = await confirmQuickMatchPay(initialState(), deps);

    expect(mocks.batchPayQuickMatch).not.toHaveBeenCalled();
    expect(deps.onPaid).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith("待支付金额已更新，请核对后重新确认支付");
    expect(result.expectedTotal).toBe(120);
    expect(result.ordersCreated).toBe(true);
  });

  it("活动优惠：原价与基线不同但实付一致时正常支付", async () => {
    const deps = makeDeps();
    mocks.fetchQuickMatchPayable.mockResolvedValue({
      orderCount: 1,
      totalPrice: 20,
      discountAmount: 10.1,
      realPayAmount: 9.9,
    });

    // 基线=预览 payableAmount（实付 9.9）；payable.totalPrice 为原价 20，应按 realPayAmount 比对
    const result = await confirmQuickMatchPay(
      initialState({ expectedTotal: 9.9 }),
      deps,
    );

    expect(showToast).not.toHaveBeenCalledWith("待支付金额已更新，请核对后重新确认支付");
    expect(mocks.batchPayQuickMatch).toHaveBeenCalledTimes(1);
    expect(deps.onPaid).toHaveBeenCalledWith(CREATED_ORDERS);
    expect(result.expectedTotal).toBe(9.9);
  });

  it("金额不一致后按新基线重试可完成支付", async () => {
    const deps = makeDeps();
    mocks.fetchQuickMatchPayable
      .mockResolvedValueOnce({ orderCount: 1, totalPrice: 120, realPayAmount: 120 })
      .mockResolvedValueOnce({ orderCount: 1, totalPrice: 120, realPayAmount: 120 });

    const first = await confirmQuickMatchPay(initialState(), deps);
    const second = await confirmQuickMatchPay(first, deps);

    expect(mocks.batchPayQuickMatch).toHaveBeenCalledTimes(1);
    expect(deps.onPaid).toHaveBeenCalledWith(CREATED_ORDERS);
    expect(second.expectedTotal).toBe(120);
  });

  it("建单失败：提示并保持可重试", async () => {
    const deps = makeDeps();
    mocks.selectAndCreateOrder.mockRejectedValueOnce(new Error("人数已满"));

    const result = await confirmQuickMatchPay(initialState(), deps);

    expect(showToast).toHaveBeenCalledWith("人数已满");
    expect(deps.onOrdersCreated).not.toHaveBeenCalled();
    expect(mocks.fetchQuickMatchPayable).not.toHaveBeenCalled();
    expect(result.ordersCreated).toBe(false);

    const retried = await confirmQuickMatchPay(result, deps);
    expect(retried.ordersCreated).toBe(true);
    expect(deps.onPaid).toHaveBeenCalledTimes(1);
  });

  it("服务端 STAR_NOT_ENOUGH 引导余额不足，不提示支付失败", async () => {
    const deps = makeDeps();
    mocks.batchPayQuickMatch.mockRejectedValueOnce(
      new mocks.StarNotEnoughError("钻石余额不足"),
    );

    const result = await confirmQuickMatchPay(initialState(), deps);

    expect(deps.onBalanceInsufficient).toHaveBeenCalledTimes(1);
    expect(showToast).not.toHaveBeenCalledWith("钻石余额不足");
    expect(result.ordersCreated).toBe(true);
  });

  it("本地余额不足不发起支付", async () => {
    const deps = makeDeps({ balance: 50 });

    const result = await confirmQuickMatchPay(initialState(), deps);

    expect(deps.onBalanceInsufficient).toHaveBeenCalledTimes(1);
    expect(mocks.batchPayQuickMatch).not.toHaveBeenCalled();
    expect(result.ordersCreated).toBe(true);
  });

  it("快照失配：关闭回匹配，不建单不支付", async () => {
    const deps = makeDeps({
      selectionMatchesSnapshot: vi.fn(() => false),
    });

    const result = await confirmQuickMatchPay(initialState(), deps);

    expect(deps.onSelectionChanged).toHaveBeenCalledTimes(1);
    expect(mocks.selectAndCreateOrder).not.toHaveBeenCalled();
    expect(result).toEqual(initialState());
  });

  it("payable 查询失败：提示并保持已建单状态可重试", async () => {
    const deps = makeDeps();
    mocks.fetchQuickMatchPayable.mockRejectedValueOnce(new Error("网络异常"));

    const result = await confirmQuickMatchPay(initialState(), deps);

    expect(showToast).toHaveBeenCalledWith("网络异常");
    expect(mocks.batchPayQuickMatch).not.toHaveBeenCalled();
    expect(result.ordersCreated).toBe(true);
  });

  it("orderCount 为 0 时沿用基线金额做余额检查", async () => {
    const deps = makeDeps();
    mocks.fetchQuickMatchPayable.mockResolvedValue({
      orderCount: 0,
      totalPrice: 0,
    });

    const result = await confirmQuickMatchPay(initialState(), deps);

    expect(mocks.batchPayQuickMatch).toHaveBeenCalledTimes(1);
    expect(result.expectedTotal).toBe(100);
  });
});
