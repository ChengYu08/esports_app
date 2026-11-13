import { useEffect } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { OrderItemModel } from "../order.types";
import { useOrderDetailActions } from "./use-order-detail-actions";

const { completeOrder, refresh, toast, freeOrderService, selectMultiCompanions, startOrderService } = vi.hoisted(() => ({ completeOrder: vi.fn(), refresh: vi.fn(), toast: vi.fn(), freeOrderService: vi.fn(), selectMultiCompanions: vi.fn(), startOrderService: vi.fn() }));
vi.mock("@/features/order/order.api", () => ({ completeOrder, freeOrderService, selectMultiCompanions, startOrderService }));
vi.mock("@/features/order/order-query", () => ({ refreshOrderAfterAction: refresh, invalidateOrderQueries: vi.fn() }));
vi.mock("@/features/order/order-detail-format", () => ({ imageSourceUri: vi.fn() }));
vi.mock("@/features/order/after-sale-card", () => ({ buildAfterSalePayload: vi.fn() }));
vi.mock("@/features/order/order-review-cache", () => ({ clearOrderReviewSnapshot: vi.fn() }));
vi.mock("@/shared/navigation/require-login", () => ({ requireLogin: () => true }));
vi.mock("@/shared/ui/app-confirm", () => ({ useAppConfirm: {} }));
vi.mock("@/shared/ui/app-toast", () => ({ showToast: toast }));
vi.mock("expo-clipboard", () => ({ setStringAsync: vi.fn() }));
vi.mock("expo-router", () => ({ router: { push: vi.fn() } }));
vi.mock("@esports/auth", () => ({
  useAuthStore: (selector: (state: unknown) => unknown) => selector({ accessToken: "token", user: { id: "u1" } }),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let actions: ReturnType<typeof useOrderDetailActions>;
let renderer: ReactTestRenderer;
function Harness({ scope }: { scope: "accept" | "place" }) {
  const value = useOrderDetailActions({ order: { id: "1", quantity: 1, totalPrice: "100" } as OrderItemModel, scope, refetch: vi.fn().mockResolvedValue(undefined) });
  useEffect(() => { actions = value; });
  return null;
}
beforeEach(() => {
  vi.clearAllMocks();
  completeOrder.mockResolvedValue(undefined);
  refresh.mockResolvedValue(undefined);
});
afterEach(async () => {
  if (renderer) {
    await act(async () => renderer.unmount());
  }
});

describe.each(["place", "accept"] as const)("%s 详情完成订单", (scope) => {
  it("免单及选人失败向抽屉抛出错误，并释放操作状态", async () => {
    const error = new Error("网络异常");
    freeOrderService.mockRejectedValue(error);
    selectMultiCompanions.mockRejectedValue(error);
    await act(async () => { renderer = create(<Harness scope={scope} />); });
    await act(async () => { await expect(actions.runFreeOrder(0.5)).rejects.toBe(error); });
    expect(actions.actionPending).toBe(false);
    await act(async () => { await expect(actions.confirmMultiCompanions([2])).rejects.toBe(error); });
    expect(actions.actionPending).toBe(false);
    expect(actions.prompt).toBeNull();
  });
  it("失败交给抽屉内提示，释放提交锁，不打开第二个原生弹窗", async () => {
    const error = new Error("订单服务时间过短，请稍后再试！");
    completeOrder.mockRejectedValueOnce(error);
    await act(async () => { renderer = create(<Harness scope={scope} />); });
    await act(async () => { actions.setCompletePromptVisible(true); });
    await act(async () => { await expect(actions.confirmCompleteAccept()).rejects.toBe(error); });
    expect(actions.actionPending).toBe(false);
    expect(actions.completePromptVisible).toBe(true);
    expect(actions.prompt).toBeNull();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("完成成功后刷新挂起或失败，不阻塞关闭，也不误报完成失败", async () => {
    let failRefresh!: (error: Error) => void;
    refresh.mockReturnValue(new Promise((_, reject) => { failRefresh = reject; }));
    await act(async () => { renderer = create(<Harness scope={scope} />); });
    await act(async () => { actions.setCompletePromptVisible(true); });
    let settled = false;
    await act(async () => {
      actions.confirmCompleteAccept().then(() => { settled = true; });
      await Promise.resolve();
    });
    expect(settled).toBe(true);
    expect(actions.actionPending).toBe(false);
    expect(actions.completePromptVisible).toBe(false);
    expect(toast).toHaveBeenCalledWith("订单已完成");
    await act(async () => { failRefresh(new Error("网络异常")); });
    expect(actions.prompt).toBeNull();
    expect(toast).toHaveBeenCalledWith("订单已完成，列表刷新失败，请稍后刷新");
  });
});
