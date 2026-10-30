import { buildAfterSalePayload } from "@/features/order/after-sale-card";
import {
  computeFreeStarAmount,
  computeOrderPayableStars,
} from "@/features/order/free-amount";
import { imageSourceUri } from "@/features/order/order-detail-format";
import {
  invalidateOrderQueries,
  refreshOrderAfterAction,
} from "@/features/order/order-query";
import {
  acceptOrder,
  cancelOrder,
  completeOrder,
  fetchAfterSaleMembers,
  fetchOrderReview,
  freeOrderService,
  rejectOrder,
  startOrderService,
  submitOrderReview,
  type AfterSaleMember,
  type OrderReview,
} from "@/features/order/order.api";
import type { OrderAction, OrderItemModel } from "@/features/order/order.types";
import { requireLogin } from "@/shared/navigation/require-login";
import { useAppConfirm } from "@/shared/ui/app-confirm";
import { showToast } from "@/shared/ui/app-toast";
import { useAuthStore } from "@esports/auth";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useState } from "react";

type OrderDetailScope = "accept" | "place";

type Args = {
  order: OrderItemModel | undefined;
  scope: OrderDetailScope;
  refetch: () => Promise<unknown>;
};

/** 订单详情页全部交互流：取消/完成/拒绝/免单/评价/售后/聊天 */
export function useOrderDetailActions({ order, scope, refetch }: Args) {
  const token = useAuthStore((state) => state.accessToken);
  const currentUser = useAuthStore((state) => state.user);
  const [cancelPromptVisible, setCancelPromptVisible] = useState(false);
  const [completePromptVisible, setCompletePromptVisible] = useState(false);
  const [afterSaleVisible, setAfterSaleVisible] = useState(false);
  const [afterSaleMembers, setAfterSaleMembers] = useState<AfterSaleMember[]>(
    [],
  );
  const [afterSaleLoading, setAfterSaleLoading] = useState(false);
  const [reviewVisible, setReviewVisible] = useState(false);
  const [reviewDetail, setReviewDetail] = useState<OrderReview | null>(null);
  const [actionPrompt, setActionPrompt] = useState<"reject" | "free" | null>(
    null,
  );
  const [actionPending, setActionPending] = useState(false);
  const [prompt, setPrompt] = useState<{
    title: string;
    message: string;
  } | null>(null);

  // 列表接口在操作后常返回旧状态，以详情为准就地刷新缓存中的该单再刷新详情。
  const syncAfterMutation = async () => {
    if (!order || !token) {
      return;
    }
    if (currentUser?.id) {
      await refreshOrderAfterAction(order.id, token, currentUser.id);
    } else {
      await invalidateOrderQueries(order.id);
    }
    await refetch();
  };

  const handleChat = () => {
    if (!order) return;
    if (!requireLogin()) return;
    const chatUserId =
      scope === "accept" ? order.buyerUserId : order.receiverUserId;
    if (!chatUserId || chatUserId === "0") {
      setPrompt({
        title: "暂时无法聊天",
        message: "订单暂无接单者信息，请稍后重试",
      });
      return;
    }
    router.push({
      pathname: "/chat/[id]",
      params: {
        id: chatUserId,
        title: order.sellerName,
        avatar: imageSourceUri(order.sellerAvatar),
        clubId: order.clubId ? String(order.clubId) : "",
      },
    });
  };

  const copyOrderNumber = async () => {
    if (!order) {
      return;
    }
    const orderNumber = order.orderNo ?? order.id;
    try {
      await Clipboard.setStringAsync(orderNumber);
      showToast("订单编号已复制");
    } catch {
      showToast("复制失败，请稍后重试");
    }
  };

  const runAcceptAction = async (action: OrderAction["key"]) => {
    if (!order || !token) return;
    if (action === "reject" || action === "free") {
      setActionPrompt(action);
      return;
    }
    if (action === "complete") {
      setCompletePromptVisible(true);
      return;
    }
    setActionPending(true);
    try {
      if (action === "accept") await acceptOrder(order.id, token);
      if (action === "start") await startOrderService(order.id, token);
      await syncAfterMutation();
      showToast("操作成功");
    } catch (error) {
      setPrompt({
        title: "订单操作失败",
        message: error instanceof Error ? error.message : "请稍后重试",
      });
    } finally {
      setActionPending(false);
    }
  };

  const runFreeOrder = async (freeHours?: number) => {
    if (!order || !token || actionPending) {
      return;
    }
    if (freeHours == null) {
      return;
    }
    const starAmount = computeFreeStarAmount(order, freeHours);
    if (
      starAmount == null ||
      starAmount <= 0 ||
      freeHours > order.quantity ||
      starAmount > computeOrderPayableStars(order)
    ) {
      return;
    }
    setActionPending(true);
    try {
      await freeOrderService(order.id, starAmount, token);
      setActionPrompt(null);
      await syncAfterMutation();
      showToast("免单成功");
    } catch (error) {
      setPrompt({
        title: "免单失败",
        message: error instanceof Error ? error.message : "请稍后重试",
      });
    } finally {
      setActionPending(false);
    }
  };

  const handleDetailAction = async (action: OrderAction) => {
    if (!order) return;
    if (scope === "accept") {
      await runAcceptAction(action.key);
      return;
    }
    if (action.key === "cancel") setCancelPromptVisible(true);
    else if (action.key === "complete") setCompletePromptVisible(true);
    else if (action.key === "afterSales") {
      if (order.clubId == null) {
        void useAppConfirm.getState().confirm({
          title: "暂无法申请售后",
          message: "缺少俱乐部信息，无法申请售后",
        });
        return;
      }
      setAfterSaleVisible(true);
      if (token) {
        setAfterSaleLoading(true);
        void fetchAfterSaleMembers(order.clubId, token)
          .then(setAfterSaleMembers)
          .catch(() => setAfterSaleMembers([]))
          .finally(() => setAfterSaleLoading(false));
      } else setAfterSaleMembers([]);
    } else if (action.key === "review") {
      setReviewVisible(true);
      setReviewDetail(null);
      if (order.reviewId && token)
        void fetchOrderReview(order.reviewId, token)
          .then(setReviewDetail)
          .catch(() => undefined);
    } else if (action.key === "reorder") {
      router.push({
        pathname: "/profile",
        params: {
          clubId: String(order.clubId || ""),
          userId: String(order.receiverUserId || ""),
        },
      });
    }
  };

  const confirmCancelOrder = () => {
    setCancelPromptVisible(false);
    if (!order || !token) return;
    void cancelOrder(String(order.id), token)
      .then(syncAfterMutation)
      .catch((error) => {
        setPrompt({
          title: "取消订单失败",
          message: error instanceof Error ? error.message : "请稍后重试",
        });
      });
  };

  /** 下单方视角的完成订单：走确认弹窗后仅失效缓存并刷新详情 */
  const confirmCompletePlace = () => {
    setCompletePromptVisible(false);
    if (!order || !token) return;
    void completeOrder(order.id, token)
      .then(async () => {
        await invalidateOrderQueries(order.id);
        await refetch();
      })
      .catch((error) =>
        setPrompt({
          title: "完成订单失败",
          message: error instanceof Error ? error.message : "请稍后重试",
        }),
      );
  };

  /** 陪玩方视角的完成服务：确认弹窗提交中不可关闭，成功后就地刷新列表 */
  const confirmCompleteAccept = async () => {
    if (!order || !token || actionPending) return;
    setActionPending(true);
    try {
      await completeOrder(order.id, token);
      setCompletePromptVisible(false);
      await syncAfterMutation();
      showToast("订单已完成");
    } catch (error) {
      setPrompt({
        title: "完成订单失败",
        message: error instanceof Error ? error.message : "请稍后重试",
      });
    } finally {
      setActionPending(false);
    }
  };

  const confirmRejectOrder = () => {
    const action = actionPrompt;
    setActionPrompt(null);
    if (!order || !token || !action) return;
    setActionPending(true);
    void rejectOrder(order.id, token)
      .then(async () => {
        await syncAfterMutation();
        showToast("操作成功");
      })
      .catch((error) =>
        setPrompt({
          title: "拒绝失败",
          message: error instanceof Error ? error.message : "请稍后重试",
        }),
      )
      .finally(() => setActionPending(false));
  };

  const submitReview = async (rating: number, content: string) => {
    if (!order || !token) return;
    await submitOrderReview(order.orderNo || order.id, rating, content, token);
    setReviewDetail({ rating, content });
    if (currentUser?.id) {
      // 评价后列表卡片需换成「已评价」，同样以详情为准就地刷新。
      await refreshOrderAfterAction(order.id, token, currentUser.id);
    }
    await refetch();
  };

  const contactAfterSaleMember = (member: AfterSaleMember) => {
    if (!order) {
      return;
    }
    setAfterSaleVisible(false);
    const payload = buildAfterSalePayload(order, member.userId);
    router.push({
      pathname: "/chat/[id]",
      params: {
        id: String(member.userId),
        title: member.nickname || "售后客服",
        avatar: member.headImage || "",
        clubId: order.clubId ? String(order.clubId) : "",
        afterSale: JSON.stringify(payload),
      },
    });
  };

  return {
    prompt,
    setPrompt,
    actionPending,
    cancelPromptVisible,
    setCancelPromptVisible,
    completePromptVisible,
    setCompletePromptVisible,
    actionPrompt,
    setActionPrompt,
    afterSaleVisible,
    setAfterSaleVisible,
    afterSaleMembers,
    afterSaleLoading,
    reviewVisible,
    setReviewVisible,
    reviewDetail,
    handleChat,
    copyOrderNumber,
    handleDetailAction,
    runFreeOrder,
    confirmCancelOrder,
    confirmCompletePlace,
    confirmCompleteAccept,
    confirmRejectOrder,
    submitReview,
    contactAfterSaleMember,
  };
}
