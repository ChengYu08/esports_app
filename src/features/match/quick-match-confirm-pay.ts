import {
    batchPayQuickMatch,
    fetchQuickMatchPayable,
    selectAndCreateOrder,
    StarNotEnoughError,
} from "@/features/match/api/match.api";
import type {
    QuickMatchCreatedOrder,
    QuickMatchPayable,
} from "@/features/match/api/match.types";
import { showToast } from "@/shared/ui/app-toast";

export type ConfirmPayState = {
  /** 建单是否已成功（成功后重试支付不再建单） */
  ordersCreated: boolean;
  /** 支付基线金额：来自预览实付或最近一次 payable 查询 */
  expectedTotal: number;
  /** 建单返回的订单列表，支付成功后回传给调用方 */
  orders: QuickMatchCreatedOrder[];
};

export type ConfirmPayDeps = {
  requestNo: string;
  token: string;
  /** 预览时的选择快照，建单按快照执行 */
  grabIds: string[];
  /** 当前钻石余额（打开弹窗时拉取） */
  balance: number;
  /** 当前选择是否仍与预览快照一致（防御：正常被冻结机制保证） */
  selectionMatchesSnapshot: () => boolean;
  /** 快照失配：关闭弹窗回匹配重新选人 */
  onSelectionChanged: () => void;
  /** 建单成功：父级置 orderPending 防止超时/结束信令清会话 */
  onOrdersCreated: () => void;
  /** 余额不足（本地检查或服务端 STAR_NOT_ENOUGH） */
  onBalanceInsufficient: () => void;
  /** 支付成功 */
  onPaid: (orders: QuickMatchCreatedOrder[]) => void;
};

async function fetchPayable(
  deps: ConfirmPayDeps,
): Promise<QuickMatchPayable | null> {
  try {
    return await fetchQuickMatchPayable(deps.requestNo, deps.token);
  } catch (error) {
    showToast(error instanceof Error ? error.message : "待支付金额查询失败");
    return null;
  }
}

/**
 * 确认支付编排（对齐 PC OrderPayConfirmModal payNow 分支）：
 * 快照校验 → 未建单先建单 → payable 金额比对 → 余额检查 → 批量支付。
 * 任何中间失败都保持弹窗可重试，返回更新后的状态。
 */
export async function confirmQuickMatchPay(
  state: ConfirmPayState,
  deps: ConfirmPayDeps,
): Promise<ConfirmPayState> {
  if (!deps.selectionMatchesSnapshot()) {
    showToast("大神选择已变化，请重新确认");
    deps.onSelectionChanged();
    return state;
  }

  let ordersCreated = state.ordersCreated;
  let orders = state.orders;
  if (!ordersCreated) {
    try {
      const created = await selectAndCreateOrder(
        deps.requestNo,
        deps.grabIds,
        deps.token,
      );
      ordersCreated = true;
      orders = created.orders;
      deps.onOrdersCreated();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "创建订单失败");
      return { ...state };
    }
  }

  const payable = await fetchPayable(deps);
  if (!payable) {
    return { ordersCreated, expectedTotal: state.expectedTotal, orders };
  }
  // 对齐 PC：优先实付 realPayAmount，无则回退原价 totalPrice
  const currentTotal = payable.realPayAmount ?? payable.totalPrice;
  if (
    payable.orderCount > 0 &&
    Math.abs(currentTotal - state.expectedTotal) > 0.001
  ) {
    showToast("待支付金额已更新，请核对后重新确认支付");
    return { ordersCreated, expectedTotal: currentTotal, orders };
  }
  const payTotal = payable.orderCount > 0 ? currentTotal : state.expectedTotal;
  if (deps.balance < payTotal) {
    deps.onBalanceInsufficient();
    return { ordersCreated, expectedTotal: payTotal, orders };
  }

  try {
    await batchPayQuickMatch(deps.requestNo, deps.token);
  } catch (error) {
    if (error instanceof StarNotEnoughError) {
      deps.onBalanceInsufficient();
      return { ordersCreated, expectedTotal: payTotal, orders };
    }
    showToast(error instanceof Error ? error.message : "支付失败");
    return { ordersCreated, expectedTotal: payTotal, orders };
  }

  deps.onPaid(orders);
  return { ordersCreated, expectedTotal: payTotal, orders };
}
