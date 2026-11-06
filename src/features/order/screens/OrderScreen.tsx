import { StarPaymentPrompt } from "../components/StarPaymentPrompt";
import { queryClient } from "@/core/query/query-client";
import { useAppConfirm } from "@/shared/ui/app-confirm";
import { showToast } from "@/shared/ui/app-toast";
import { AppPrompt } from "@/shared/ui/AppPrompt";
import { useAuthStore } from "@esports/auth";
import { router, useFocusEffect, useIsFocused, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { grabQuickMatchAndEnterAudition } from "@/features/match/grab-quick-match-flow";
import { useCustomerServiceEntry } from "@/features/mine/hooks/use-customer-service-entry";
import { useHomeGames } from "@/features/home/hooks/use-home-data";
import { EmptyState, ErrorState, LoadingState } from "@/shared/ui/AsyncStates";
import { PaginationFooter } from "@/shared/ui/PaginationFooter";
import { buildAfterSalePayload } from "../after-sale-card";
import { OrderAfterSaleSheet } from "../components/OrderAfterSaleSheet";
import { OrderMultiCompanionSheet } from "../components/OrderMultiCompanionSheet";
import { OrderCard } from "../components/OrderCard";
import { OrderCompleteConfirmSheet } from "../components/OrderCompleteConfirmSheet";
import { OrderFreeConfirmFlow } from "../components/OrderFreeConfirmFlow";
import { OrderHeader } from "../components/OrderHeader";
import { OrderReviewSheet } from "../components/OrderReviewSheet";
import { OrderScopeTabs } from "../components/OrderScopeTabs";
import { OrderTabs } from "../components/OrderTabs";
import {
  computeFreeStarAmount,
  computeFreeSubmitAmount,
  computeOrderPayableStars,
} from "../free-amount";
import { useOrderPage } from "../hooks/use-order-page";
import { useOrderClubNames } from "../hooks/use-order-club-names";
import { afterOrderPaidOpenChat } from "../notify-order-paid";
import {
  invalidateOrderQueries,
  refreshOrderAfterAction,
} from "../order-query";
import {
  acceptOrder,
  cancelOrder as cancelOrderRequest,
  completeOrder as completeOrderRequest,
  fetchAfterSaleMembers,
  fetchMultiCompanionCandidates,
  fetchOrderReview,
  freeOrderService,
  rejectOrder,
  selectMultiCompanions,
  startOrderService,
  submitOrderReview,
  type AfterSaleMember,
  type MultiCompanionCandidate,
  type OrderReview,
} from "../order.api";
import {
  multiCompanionNeedSelect,
  needsMultiCompanionSelect,
} from "../multi-companion";
import { getPaymentDeadline } from "../payment-countdown";
import type {
  OrderActionKey,
  OrderFilter,
  OrderItemModel,
} from "../order.types";

export default function OrderScreen() {
  const focused = useIsFocused();
  const games = useHomeGames(focused);
  const gameIconsByName = useMemo(() => {
    const icons = new Map<string, string | null>();
    for (const game of games.data ?? []) {
      if (!game.name || !game.iconUrl) {
        continue;
      }
      icons.set(game.name, icons.has(game.name) ? null : game.iconUrl);
    }
    return icons;
  }, [games.data]);
  const insets = useSafeAreaInsets();
  const { scope: requestedScope } = useLocalSearchParams<{ scope?: string }>();
  const isCompanion = useAuthStore((state) => state.isCompanion);
  const { openCustomerService } = useCustomerServiceEntry();
  const [selectedScope, setSelectedScope] = useState<
    "dispatch" | "accept" | "place"
  >(() => (isCompanion ? "dispatch" : "place"));
  const [filter, setFilter] = useState<OrderFilter>(() =>
    isCompanion ? "grabbing" : "all",
  );
  useFocusEffect(
    useCallback(() => {
      if (requestedScope === "accept" && isCompanion) {
        setSelectedScope("accept");
        setFilter("all");
        router.setParams({ scope: undefined });
      }
    }, [requestedScope, isCompanion]),
  );
  const scope = isCompanion ? selectedScope : "place";
  const visibleFilter =
    scope === "dispatch"
      ? filter === "history"
        ? "history"
        : "grabbing"
      : filter === "grabbing" || filter === "history"
        ? "all"
        : filter;
  const orders = useOrderPage(scope, visibleFilter, focused);
  const token = useAuthStore((state) => state.accessToken);
  const currentUser = useAuthStore((state) => state.user);
  const currentUserId = currentUser?.id;
  const [rejectTarget, setRejectTarget] = useState<OrderItemModel | null>(null);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const pendingOrderRef = useRef<string | null>(null);
  const expiryRefetchTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const expiryRefetchScheduled = useRef(false);
  const clearExpiryRefetch = useCallback(() => {
    expiryRefetchTimers.current.forEach(clearTimeout);
    expiryRefetchTimers.current = [];
    expiryRefetchScheduled.current = false;
  }, []);
  useFocusEffect(
    useCallback(() => () => {
      // 离开订单页后取消补拉，避免回到首页时继续请求旧列表。
      clearExpiryRefetch();
    }, [clearExpiryRefetch]),
  );
  // 切换订单范围时，旧范围的延迟补拉不再占用新范围的刷新窗口。
  useEffect(() => clearExpiryRefetch, [clearExpiryRefetch, scope, visibleFilter, currentUserId]);
  useFocusEffect(
    useCallback(() => {
      if (token && currentUserId)
        void queryClient.refetchQueries(
          {
            queryKey: ["orders", scope, visibleFilter, currentUserId],
            exact: true,
            type: "active",
          },
          { cancelRefetch: false },
        );
    }, [token, currentUserId, scope, visibleFilter]),
  );
  const [cancelTarget, setCancelTarget] = useState<OrderItemModel | null>(null);
  const [completeTarget, setCompleteTarget] = useState<OrderItemModel | null>(
    null,
  );
  const [completePromptVisible, setCompletePromptVisible] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [afterSaleTarget, setAfterSaleTarget] = useState<OrderItemModel | null>(
    null,
  );
  const [afterSaleMembers, setAfterSaleMembers] = useState<AfterSaleMember[]>(
    [],
  );
  const [afterSaleLoading, setAfterSaleLoading] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<OrderItemModel | null>(null);
  const [reviewDetail, setReviewDetail] = useState<OrderReview | null>(null);
  const [payTarget, setPayTarget] = useState<OrderItemModel | null>(null);
  const [freeTarget, setFreeTarget] = useState<OrderItemModel | null>(null);
  const [freeSubmitting, setFreeSubmitting] = useState(false);
  const [multiSelectTarget, setMultiSelectTarget] = useState<OrderItemModel | null>(null);
  const [multiSelectCandidates, setMultiSelectCandidates] = useState<MultiCompanionCandidate[]>([]);
  const [multiSelectLoading, setMultiSelectLoading] = useState(false);
  const [multiSelectSubmitting, setMultiSelectSubmitting] = useState(false);
  const [prompt, setPrompt] = useState<{
    title: string;
    message: string;
    confirmText?: string;
  } | null>(null);
  // 扁平化结果用 useMemo 固定引用，避免父组件重渲染时生成新数组触发整列表重渲染
  const items = useMemo(
    () => orders.data?.pages.flatMap((page) => page.items) ?? [],
    [orders.data],
  );
  // 列表接口不回俱乐部名，按 companionClubId 批量解析（react-query 缓存，同俱乐部只查一次）。
  const clubNameById = useOrderClubNames(
    items
      .filter((item) => !item.clubName && item.clubId != null)
      .map((item) => Number(item.clubId)),
    focused,
  );
  const emptyMessage =
    scope === "dispatch"
      ? visibleFilter === "history"
        ? "暂无抢单记录"
        : "暂无可抢需求"
      : visibleFilter === "all"
        ? "暂无订单"
        : `暂无${visibleFilter === "inProgress" ? "进行中" : visibleFilter === "completed" ? "已完成" : "已取消"}订单`;

  const handlePaymentExpired = useCallback(() => {
    if (expiryRefetchScheduled.current) {
      return;
    }
    expiryRefetchScheduled.current = true;
    // 同时到期的订单复用进行中的列表请求，状态以服务端结果为准。
    // 服务端延迟消息关单比客户端倒计时归零晚几秒，一次重拉可能抢在关单前，错峰补拉两轮。
    const refetch = () =>
      queryClient
        .refetchQueries(
          {
            queryKey: ["orders", scope, visibleFilter, currentUserId],
            exact: true,
            type: "active",
          },
          { cancelRefetch: false },
        )
        .catch(() => undefined);
    refetch();
    expiryRefetchTimers.current = [
      setTimeout(refetch, 4000),
      setTimeout(() => {
        refetch();
        expiryRefetchTimers.current = [];
        expiryRefetchScheduled.current = false;
      }, 12000),
    ];
  }, [scope, visibleFilter, currentUserId]);

  // 用 useCallback 固定回调引用，保证 OrderCard 的 memo 不被每次渲染的新闭包击穿
  const handleOrderAction = useCallback(
    async (item: OrderItemModel, action: OrderActionKey) => {
    if (action === "pay") {
      const deadline = getPaymentDeadline(item);
      if (deadline !== null && Date.now() >= deadline) {
        // 已过支付截止时间：服务端自动关单有秒级延迟，刷新列表取已取消状态
        showToast("订单支付已超时");
        handlePaymentExpired();
        return;
      }
      setPayTarget(item);
      return;
    }
    if (action === "cancel") setCancelTarget(item);
    if (action === "complete") {
      setCompleteTarget(item);
      setCompletePromptVisible(true);
    }
    if (action === "free") setFreeTarget(item);
    if (action === "reject") {
      setRejectTarget(item);
      return;
    }
    if (action === "grab" && item.requestNo && token) {
      if (pendingOrderRef.current) return;
      pendingOrderRef.current = item.id;
      setPendingOrderId(item.id);
      try {
        // 与抢单条同一条流程：需要试音的订单抢单成功后直接进试音房
        const result = await grabQuickMatchAndEnterAudition(item.requestNo);
        if (result.status === "failed") showToast(result.message);
      } finally {
        pendingOrderRef.current = null;
        setPendingOrderId(null);
      }
    }
    // 一单多陪且参与陪玩未选满：先弹选人弹窗，确认后再开始服务
    if (action === "start" && needsMultiCompanionSelect(item) && token) {
      setMultiSelectTarget(item);
      setMultiSelectCandidates([]);
      setMultiSelectLoading(true);
      void fetchMultiCompanionCandidates(item.id, token)
        .then(setMultiSelectCandidates)
        .catch(() => {
          setMultiSelectCandidates([]);
          showToast("获取可选陪玩失败，请稍后重试");
        })
        .finally(() => setMultiSelectLoading(false));
      return;
    }
    if (
      (action === "accept" || action === "start") &&
      token
    ) {
      if (pendingOrderRef.current) return;
      pendingOrderRef.current = item.id;
      setPendingOrderId(item.id);
      let actionSucceeded = false;
      try {
        if (action === "accept") await acceptOrder(item.id, token);
        if (action === "start") await startOrderService(item.id, token);
        actionSucceeded = true;
        if (currentUser?.id) {
          // 列表接口此时可能仍返回旧状态，以详情为准就地替换该单卡片。
          await refreshOrderAfterAction(item.id, token, currentUser.id);
        } else {
          await invalidateOrderQueries(item.id);
        }
      } catch (error) {
        setPrompt({
          title: actionSucceeded ? "订单已更新" : "订单操作失败",
          message: actionSucceeded
            ? "状态刷新失败，请下拉刷新订单列表"
            : error instanceof Error
              ? error.message
              : "请稍后重试",
        });
      } finally {
        pendingOrderRef.current = null;
        setPendingOrderId(null);
      }
    }
    if (action === "afterSales") {
      if (item.clubId == null) {
        void useAppConfirm.getState().confirm({
          title: "暂无法申请售后",
          message: "缺少俱乐部信息，无法申请售后",
        });
        return;
      }
      setAfterSaleTarget(item);
      if (token && item.clubId) {
        setAfterSaleLoading(true);
        void fetchAfterSaleMembers(item.clubId, token)
          .then(setAfterSaleMembers)
          .catch(() => setAfterSaleMembers([]))
          .finally(() => setAfterSaleLoading(false));
      } else setAfterSaleMembers([]);
    }
    if (action === "review") {
      setReviewTarget(item);
      setReviewDetail(null);
      if (item.reviewId && token)
        void fetchOrderReview(item.reviewId, token)
          .then(setReviewDetail)
          .catch(() => undefined);
    }
    if (action === "reorder")
      router.push({
        pathname: "/profile",
        params: {
          clubId: String(item.clubId || ""),
          userId: String(item.receiverUserId || ""),
          reorderGame: item.gameName,
          reorderMode: item.gameModeName ?? "",
          reorderLevel: item.gameLevelName ?? "",
          reorderService: item.orderServiceName ?? "",
          reorderQuantity: String(item.quantity),
        },
      });
    },
    [token, currentUser, handlePaymentExpired],
  );

  /** 一单多陪选人确认：提交参与陪玩后立即开始服务，就地刷新该单卡片 */
  const confirmMultiCompanions = async (userIds: number[]) => {
    const target = multiSelectTarget;
    if (!target || !token || multiSelectSubmitting) {
      return;
    }
    setMultiSelectSubmitting(true);
    try {
      await selectMultiCompanions(target.id, userIds, token);
      await startOrderService(target.id, token);
      setMultiSelectTarget(null);
      if (currentUser?.id) {
        await refreshOrderAfterAction(target.id, token, currentUser.id);
      } else {
        await invalidateOrderQueries(target.id);
      }
      showToast("操作成功");
    } catch (error) {
      setPrompt({
        title: "订单操作失败",
        message: error instanceof Error ? error.message : "请稍后重试",
      });
    } finally {
      setMultiSelectSubmitting(false);
    }
  };

  const confirmReject = async () => {
    if (!rejectTarget || !token || pendingOrderRef.current) {
      return;
    }
    if (useAuthStore.getState().accessToken !== token) {
      setRejectTarget(null);
      showToast("登录状态已变化，请重新操作");
      return;
    }
    const target = rejectTarget;
    setRejectTarget(null);
    pendingOrderRef.current = target.id;
    setPendingOrderId(target.id);
    let rejected = false;
    try {
      await rejectOrder(target.id, token);
      rejected = true;
      if (currentUser?.id) {
        await refreshOrderAfterAction(target.id, token, currentUser.id);
      } else {
        await invalidateOrderQueries(target.id);
      }
    } catch (error) {
      setPrompt({
        title: rejected ? "订单已更新" : "拒绝订单失败",
        message: rejected ? "状态刷新失败，请下拉刷新订单列表" : error instanceof Error ? error.message : "请稍后重试",
      });
    } finally {
      pendingOrderRef.current = null;
      setPendingOrderId(null);
    }
  };

  const confirmCancel = async () => {
    if (!cancelTarget || !token) return;
    const target = cancelTarget;
    setCancelTarget(null);
    try {
      await cancelOrderRequest(target.id, token);
      if (currentUser?.id) {
        // 取消后列表接口可能仍返回旧状态，以详情为准就地替换该单卡片。
        await refreshOrderAfterAction(target.id, token, currentUser.id);
      } else {
        await invalidateOrderQueries(target.id);
      }
    } catch (error) {
      setPrompt({
        title: "取消订单失败",
        message: error instanceof Error ? error.message : "请稍后重试",
      });
    }
  };

  const confirmComplete = async () => {
    if (!completeTarget || !token || completing) {
      return;
    }
    const target = completeTarget;
    setCompleting(true);
    try {
      await completeOrderRequest(target.id, token);
      setCompletePromptVisible(false);
      if (currentUser?.id) {
        // 列表接口此时可能仍返回旧状态，以详情为准就地替换该单卡片。
        await refreshOrderAfterAction(target.id, token, currentUser.id);
      } else {
        await invalidateOrderQueries(target.id);
      }
      showToast("订单已完成");
    } catch (error) {
      setPrompt({
        title: "完成订单失败",
        message: error instanceof Error ? error.message : "请稍后重试",
      });
    } finally {
      setCompleting(false);
    }
  };

  const confirmFree = async (freeHours?: number) => {
    if (!freeTarget || !token || freeSubmitting) {
      return;
    }
    if (freeHours == null) {
      return;
    }
    const target = freeTarget;
    const starAmount = computeFreeStarAmount(target, freeHours);
    if (
      starAmount == null ||
      starAmount <= 0 ||
      freeHours > target.quantity ||
      starAmount > computeOrderPayableStars(target)
    ) {
      return;
    }
    // 免单金额口径：活动订单按原价退款基数折算，普通订单维持时长×单价计算值
    const freeAmount = computeFreeSubmitAmount(target, starAmount, freeHours);
    setFreeSubmitting(true);
    try {
      await freeOrderService(target.id, freeAmount, token);
      setFreeTarget(null);
      if (currentUser?.id) {
        // 全额免单与部分免单的状态不同，以详情为准就地刷新缓存中的该单。
        await refreshOrderAfterAction(target.id, token, currentUser.id);
      } else {
        await invalidateOrderQueries(target.id);
      }
      showToast("免单成功");
    } catch (error) {
      setPrompt({
        title: "免单失败",
        message: error instanceof Error ? error.message : "请稍后重试",
      });
    } finally {
      setFreeSubmitting(false);
    }
  };

  // 点击卡片跳转：签名接收 item，保持稳定引用以配合 OrderCard 的 memo
  const handleOrderPress = useCallback(
    (order: OrderItemModel) => {
      if (order.requestNo)
        router.push(
          `/order/dispatch/${encodeURIComponent(order.requestNo)}`,
        );
      else router.push(`/order/${order.id}?scope=${scope}`);
    },
    [scope],
  );

  // renderItem 稳定引用 + 空态收敛到 useMemo，避免无关重渲染波及列表
  const renderOrderItem = useCallback(
    ({ item }: { item: OrderItemModel }) => (
      <OrderCard
        item={item}
        active={focused}
        scope={scope}
        gameIcon={gameIconsByName.get(item.gameName) ? { uri: gameIconsByName.get(item.gameName)! } : undefined}
        clubName={
          item.clubName ??
          (item.clubId != null ? clubNameById[item.clubId] : undefined)
        }
        actionPending={pendingOrderId === item.id}
        onAction={handleOrderAction}
        onPress={handleOrderPress}
        onPaymentExpired={handlePaymentExpired}
      />
    ),
    [clubNameById, pendingOrderId, handleOrderAction, handleOrderPress, handlePaymentExpired, scope, gameIconsByName, focused],
  );

  // refetch 在 react-query 中是稳定引用，解构后作为依赖可让 memo 长效命中
  const refetchOrders = orders.refetch;
  const listEmpty = useMemo(() => {
    if (orders.isLoading) {
      return <LoadingState />;
    }
    if (orders.isError) {
      return <ErrorState onRetry={() => void refetchOrders()} />;
    }
    return (
      <View style={styles.empty}>
        <EmptyState message={emptyMessage} />
      </View>
    );
  }, [orders.isLoading, orders.isError, refetchOrders, emptyMessage]);

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <View style={[styles.stickyHeader, { paddingTop: insets.top }]}>
        {isCompanion ? null : <OrderHeader />}
        {isCompanion ? (
          <OrderScopeTabs
            value={scope}
            onChange={(nextScope) => {
              setSelectedScope(nextScope);
              setFilter(nextScope === "dispatch" ? "grabbing" : "all");
            }}
          />
        ) : null}
        <OrderTabs scope={scope} onChange={setFilter} value={visibleFilter} />
      </View>
      <FlatList
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 80 + insets.bottom },
        ]}
        data={items}
        ItemSeparatorComponent={OrderSeparator}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={listEmpty}
        ListFooterComponent={
          items.length > 0 ? (
            <PaginationFooter
              loading={orders.isFetchingNextPage}
              hasMore={orders.hasNextPage}
              pageCount={orders.data?.pages.length}
            />
          ) : null
        }
        onEndReached={() => {
          if (orders.hasNextPage && !orders.isFetchingNextPage) {
            void orders.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.35}
        renderItem={renderOrderItem}
        refreshControl={
          <RefreshControl
            refreshing={orders.isRefetching}
            onRefresh={() => void orders.refetch()}
            tintColor="#ff214b"
          />
        }
        showsVerticalScrollIndicator={false}
      />
      <AppPrompt
        visible={Boolean(rejectTarget)}
        title="拒绝订单"
        message="拒绝后订单将直接关闭，是否确认拒绝？"
        cancelText="取消"
        confirmText="确认"
        onCancel={() => setRejectTarget(null)}
        onConfirm={confirmReject}
      />
      <AppPrompt
        visible={Boolean(cancelTarget)}
        title="提示"
        message={`确定取消订单吗，订单号：${cancelTarget?.orderNo ?? cancelTarget?.id ?? ""}`}
        cancelText="取消"
        confirmText="确认"
        onCancel={() => setCancelTarget(null)}
        onConfirm={() => void confirmCancel()}
      />
      <OrderAfterSaleSheet
        visible={Boolean(afterSaleTarget)}
        loading={afterSaleLoading}
        members={afterSaleMembers}
        onClose={() => setAfterSaleTarget(null)}
        onCustomerService={openCustomerService}
        onContact={(member) => {
          const order = afterSaleTarget;
          setAfterSaleTarget(null);
          if (!order) return;
          const payload = buildAfterSalePayload(order, member.userId);
          router.push({
            pathname: "/chat/[id]",
            params: {
              id: String(member.userId),
              title: member.nickname || "售后客服",
              avatar: member.headImage || "",
              afterSale: JSON.stringify(payload),
            },
          });
        }}
      />
      <OrderMultiCompanionSheet
        visible={Boolean(multiSelectTarget)}
        needSelect={multiSelectTarget ? multiCompanionNeedSelect(multiSelectTarget) : 1}
        candidates={multiSelectCandidates}
        loading={multiSelectLoading}
        submitting={multiSelectSubmitting}
        onClose={() => setMultiSelectTarget(null)}
        onConfirm={confirmMultiCompanions}
      />
      <OrderReviewSheet
        visible={Boolean(reviewTarget)}
        readonly={Boolean(reviewTarget?.reviewExists)}
        detail={reviewDetail}
        onClose={() => setReviewTarget(null)}
        onSubmit={async (input) => {
          if (!reviewTarget || !token) return;
          await submitOrderReview(
            reviewTarget.orderNo || reviewTarget.id,
            input,
            token,
          );
          setReviewTarget((current) =>
            current ? { ...current, reviewExists: true } : current,
          );
          setReviewDetail({
            rating: input.rating,
            content: input.content,
            imageUrls: input.imageUrls,
            anonymous: input.anonymous,
          });
          if (currentUser?.id) {
            // 评价后列表卡片需换成「已评价」，同样以详情为准就地刷新。
            await refreshOrderAfterAction(
              reviewTarget.id,
              token,
              currentUser.id,
            );
          } else {
            await orders.refetch();
          }
        }}
      />
      {completeTarget ? (
        <OrderCompleteConfirmSheet
          visible={completePromptVisible}
          order={completeTarget}
          buyerName={scope === "place" ? currentUser?.nickname || "老板" : undefined}
          buyerAvatar={scope === "place" ? (currentUser?.headImage ? { uri: currentUser.headImage } : require("../../../../assets/images/avatar_default.webp")) : undefined}
          companionName={completeTarget.receiverName || (scope === "place" ? completeTarget.sellerName : currentUser?.nickname) || "陪玩师"}
          companionAvatar={
            completeTarget.receiverAvatar ??
            (scope === "accept" && currentUser?.headImage
              ? { uri: currentUser.headImage }
              : undefined)
          }
          serviceTime={(
            completeTarget.serviceStartTime ||
            completeTarget.serviceEndTime ||
            completeTarget.createTime ||
            "-"
          )
            .replace("T", " ")
            .slice(0, 19)}
          loading={completing}
          onClose={() => {
            if (!completing) {
              setCompletePromptVisible(false);
            }
          }}
          onConfirm={confirmComplete}
        />
      ) : null}
      {freeTarget ? (
        <OrderFreeConfirmFlow
          order={freeTarget}
          companionName={
            freeTarget.receiverName || currentUser?.nickname || "陪玩师"
          }
          companionAvatar={
            freeTarget.receiverAvatar ??
            (scope === "accept" && currentUser?.headImage
              ? { uri: currentUser.headImage }
              : undefined)
          }
          loading={freeSubmitting}
          onClose={() => {
            if (!freeSubmitting) {
              setFreeTarget(null);
            }
          }}
          onConfirm={confirmFree}
        />
      ) : null}
      <StarPaymentPrompt
        key={payTarget?.id ?? "none"}
        item={payTarget}
        token={token}
        onPaymentFailed={(message) => setPrompt({ title: "支付失败", message })}
        onClose={() => {
          const target = payTarget;
          // 关闭支付弹窗只结束本次支付，取消订单由订单卡片的独立操作处理。
          setPayTarget(null);
          if (target?.requestNo && token) {
            showToast("请在订单创建后5分钟内完成支付");
          }
        }}
        onPaid={() => {
          const paid = payTarget;
          setPayTarget(null);
          if (paid?.id && token && currentUser?.id) {
            // 支付成功后以详情为准就地刷新该单卡片，避免列表接口延迟仍显示待支付。
            void refreshOrderAfterAction(paid.id, token, currentUser.id);
          } else {
            void orders.refetch();
          }
          if (paid?.receiverUserId) {
            const companionUserId = String(paid.receiverUserId);
            void afterOrderPaidOpenChat({
              companionUserIds: [companionUserId],
              token,
              chat: {
                id: companionUserId,
                title: paid.receiverName || "用户聊天",
                avatar:
                  paid.receiverAvatar && "uri" in paid.receiverAvatar
                    ? String(paid.receiverAvatar.uri)
                    : undefined,
              },
            });
          } else {
            setPrompt({
              title: "支付成功",
              message: "订单已支付，可在订单页面查看进度",
            });
          }
        }}
      />
      <AppPrompt
        visible={Boolean(prompt)}
        title={prompt?.title}
        message={prompt?.message ?? ""}
        onConfirm={() => setPrompt(null)}
      />
    </View>
  );
}

function OrderSeparator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F7F7" },
  stickyHeader: { backgroundColor: "#FFFFFF" },
  content: { flexGrow: 1, paddingTop: 8 },
  separator: { height: 8 },
  empty: {
    flex: 1,
    minHeight: 320,
    alignItems: "center",
    justifyContent: "center",
  },
});
