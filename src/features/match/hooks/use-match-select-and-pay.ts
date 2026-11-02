import { useCallback, useEffect, useRef, useState } from "react";

import { selectAndCreateOrder } from "@/features/match/api/match.api";
import {
  isActivityQuickMatch,
  type QuickMatchGrabItem,
  type QuickMatchRequestDetail,
} from "@/features/match/api/match.types";
import { showToast } from "@/shared/ui/app-toast";

type UseMatchSelectAndPayOptions = {
  requestNo: string;
  token: string | null;
  /** 活动模式判定（activityCode 非空即活动模式） */
  detail: QuickMatchRequestDetail | null;
  /** 候选人列表：用于把首个选中 grabId 映射为 companionUserId 以定位支付后跳转的订单 */
  candidates: QuickMatchGrabItem[];
  /** 当前选中集合（选人状态由外部会话/弹窗容器持有，便于轮询过滤失效选择） */
  selectedGrabIds: string[];
  /** 提交中状态由外部会话持有，保证按钮禁用/取消派单拦截联动 */
  submitting: boolean;
  setSubmitting: (value: boolean) => void;
  /** 建单成功进入支付中：外部用于阻断轮询与结束信令（独立弹窗容器可不传） */
  setOrderPending?: (value: boolean) => void;
  /** 支付成功回调（参数为选中陪玩对应的订单 id，可能为 null） */
  onPaid: (orderId: string | null) => void;
};

/**
 * 「选人 + 建单 + 支付」编排（可复用单元）：
 * 匹配中页与语聊房「派单匹配中」弹窗共用；调用方持有选人与提交状态，
 * 本 hook 负责 selectAndCreateOrder 与 MatchPaySheet 的拉起。
 */
export function useMatchSelectAndPay(options: UseMatchSelectAndPayOptions) {
  const {
    requestNo,
    token,
    detail,
    candidates,
    selectedGrabIds,
    submitting,
    setSubmitting,
    setOrderPending,
    onPaid,
  } = options;

  const [payVisible, setPayVisible] = useState(false);
  const [payTotal, setPayTotal] = useState(0);
  const [discountAmount, setDiscountAmount] = useState<number | undefined>();
  const [realPayAmount, setRealPayAmount] = useState<number | undefined>();

  /** 建单结果快照（带 requestNo，容器复用换单时天然失效，无需 render 期重置） */
  const paidOrderRef = useRef<{ requestNo: string; orderId: string | null }>({
    requestNo,
    orderId: null,
  });
  /** 建单未支付标记（带 requestNo 防跨单误判） */
  const orderPendingRef = useRef<{ requestNo: string; pending: boolean }>({
    requestNo,
    pending: false,
  });
  const detailRef = useRef(detail);
  const candidatesRef = useRef(candidates);
  const selectedGrabIdsRef = useRef(selectedGrabIds);
  const submittingRef = useRef(submitting);
  const onPaidRef = useRef(onPaid);
  const setOrderPendingRef = useRef(setOrderPending);

  useEffect(() => {
    detailRef.current = detail;
  }, [detail]);

  useEffect(() => {
    candidatesRef.current = candidates;
  }, [candidates]);

  useEffect(() => {
    selectedGrabIdsRef.current = selectedGrabIds;
  }, [selectedGrabIds]);

  useEffect(() => {
    submittingRef.current = submitting;
  }, [submitting]);

  useEffect(() => {
    onPaidRef.current = onPaid;
  }, [onPaid]);

  useEffect(() => {
    setOrderPendingRef.current = setOrderPending;
  }, [setOrderPending]);

  // requestNo 变化（容器复用场景）时重置展示状态（render 阶段派生重置，避免 effect 内同步 setState）
  const [lastRequestNo, setLastRequestNo] = useState(requestNo);
  if (lastRequestNo !== requestNo) {
    setLastRequestNo(requestNo);
    setPayVisible(false);
    setPayTotal(0);
    setDiscountAmount(undefined);
    setRealPayAmount(undefined);
  }

  const activity = isActivityQuickMatch(detail);

  const confirmSelectAndPay = useCallback(async () => {
    const tokenValue = token;
    if (!tokenValue) {
      return;
    }
    const pendingEntry = orderPendingRef.current;
    if (pendingEntry.requestNo === requestNo && pendingEntry.pending) {
      // 已建单未支付：直接回到支付面板，不重复建单
      setPayVisible(true);
      return;
    }
    if (selectedGrabIdsRef.current.length === 0) {
      showToast("请先选择陪玩");
      return;
    }
    if (submittingRef.current) {
      return;
    }
    const grabIds = [...selectedGrabIdsRef.current];
    const firstGrabId = grabIds[0];
    const firstCompanionUserId = candidatesRef.current.find(
      (item) => item.id === firstGrabId,
    )?.companionUserId;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const created = await selectAndCreateOrder(requestNo, grabIds, tokenValue);
      const matchedOrder = firstCompanionUserId
        ? created.orders.find((order) => order.serviceUserId === firstCompanionUserId)
        : undefined;
      paidOrderRef.current = { requestNo, orderId: matchedOrder?.orderId ?? null };
      orderPendingRef.current = { requestNo, pending: true };
      setOrderPendingRef.current?.(true);
      setPayTotal(created.totalPrice);
      setDiscountAmount(created.discountAmount);
      setRealPayAmount(created.realPayAmount);
      setPayVisible(true);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "创建订单失败");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [requestNo, setSubmitting, token]);

  /** 供 onPress 直接绑定（内部消化异步，不向事件返回 Promise） */
  const handleConfirm = useCallback(() => {
    void confirmSelectAndPay();
  }, [confirmSelectAndPay]);

  const handlePayClose = useCallback(() => {
    setPayVisible(false);
  }, []);

  const handlePayPaid = useCallback(() => {
    setPayVisible(false);
    const entry = paidOrderRef.current;
    onPaidRef.current(entry.requestNo === requestNo ? entry.orderId : null);
  }, [requestNo]);

  const paySheetProps = {
    visible: payVisible,
    requestNo,
    token,
    fallbackTotal: payTotal,
    isActivity: activity,
    discountAmount,
    realPayAmount,
    onClose: handlePayClose,
    onPaid: handlePayPaid,
  };

  return {
    /** 是否活动模式（activityCode 非空） */
    activity,
    /** 确认下单：建单并拉起支付面板 */
    handleConfirm,
    /** 直接透传给 MatchPaySheet 的完整 props */
    paySheetProps,
  };
}
