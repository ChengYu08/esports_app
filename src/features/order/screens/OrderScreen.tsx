import { queryClient } from "@/core/query/query-client";
import { useAppConfirm } from "@/shared/ui/app-confirm";
import { showToast } from "@/shared/ui/app-toast";
import { AppPrompt } from "@/shared/ui/AppPrompt";
import { BottomSheet } from "@/shared/ui/BottomSheet";
import { useAuthStore } from "@esports/auth";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { grabQuickMatchAndEnterAudition } from "@/features/match/grab-quick-match-flow";
import {
  fetchStarBalance,
  payCompanionOrder,
} from "@/features/mine/api/companion-order.api";
import { EmptyState, ErrorState, LoadingState } from "@/shared/ui/AsyncStates";
import { buildAfterSalePayload } from "../after-sale-card";
import { OrderAfterSaleSheet } from "../components/OrderAfterSaleSheet";
import { OrderCard } from "../components/OrderCard";
import { OrderCompleteConfirmSheet } from "../components/OrderCompleteConfirmSheet";
import { OrderFreeConfirmFlow } from "../components/OrderFreeConfirmFlow";
import { OrderHeader } from "../components/OrderHeader";
import { OrderReviewSheet } from "../components/OrderReviewSheet";
import { OrderScopeTabs } from "../components/OrderScopeTabs";
import { OrderTabs } from "../components/OrderTabs";
import {
  computeFreeStarAmount,
  computeOrderPayableStars,
} from "../free-amount";
import { useOrderPage } from "../hooks/use-order-page";
import {
  invalidateOrderQueries,
  refreshOrderAfterAction,
} from "../order-query";
import {
  acceptOrder,
  cancelOrder as cancelOrderRequest,
  completeOrder as completeOrderRequest,
  fetchAfterSaleMembers,
  fetchOrderReview,
  freeOrderService,
  rejectOrder,
  startOrderService,
  submitOrderReview,
  type AfterSaleMember,
  type OrderReview,
} from "../order.api";
import type {
  OrderActionKey,
  OrderFilter,
  OrderItemModel,
} from "../order.types";

export default function OrderScreen() {
  const insets = useSafeAreaInsets();
  const { scope: requestedScope } = useLocalSearchParams<{ scope?: string }>();
  const isCompanion = useAuthStore((state) => state.isCompanion);
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
  const orders = useOrderPage(scope, visibleFilter);
  const token = useAuthStore((state) => state.accessToken);
  const currentUser = useAuthStore((state) => state.user);
  const currentUserId = currentUser?.id;
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const pendingOrderRef = useRef<string | null>(null);
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
  const [prompt, setPrompt] = useState<{
    title: string;
    message: string;
    confirmText?: string;
  } | null>(null);
  const cancelingPaymentRef = useRef(false);
  const items = orders.data?.pages.flatMap((page) => page.items) ?? [];
  const emptyMessage =
    scope === "dispatch"
      ? visibleFilter === "history"
        ? "暂无抢单记录"
        : "暂无可抢需求"
      : visibleFilter === "all"
        ? "暂无订单"
        : `暂无${visibleFilter === "inProgress" ? "进行中" : visibleFilter === "completed" ? "已完成" : "已取消"}订单`;

  const handleOrderAction = async (
    item: OrderItemModel,
    action: OrderActionKey,
  ) => {
    if (action === "pay") {
      setPayTarget(item);
      return;
    }
    if (action === "cancel") setCancelTarget(item);
    if (action === "complete") {
      setCompleteTarget(item);
      setCompletePromptVisible(true);
    }
    if (action === "free") setFreeTarget(item);
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
    if (
      (action === "accept" || action === "reject" || action === "start") &&
      token
    ) {
      if (pendingOrderRef.current) return;
      pendingOrderRef.current = item.id;
      setPendingOrderId(item.id);
      let actionSucceeded = false;
      try {
        if (action === "accept") await acceptOrder(item.id, token);
        if (action === "reject") await rejectOrder(item.id, token);
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
        },
      });
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
    if (scope !== "accept") {
      setCompletePromptVisible(false);
    }
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
    setFreeSubmitting(true);
    try {
      await freeOrderService(target.id, starAmount, token);
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
        ListEmptyComponent={
          orders.isLoading ? (
            <LoadingState />
          ) : orders.isError ? (
            <ErrorState onRetry={() => void orders.refetch()} />
          ) : (
            <View style={styles.empty}>
              <EmptyState message={emptyMessage} />
            </View>
          )
        }
        ListFooterComponent={
          orders.isFetchingNextPage ? (
            <Text style={styles.listFooter}>加载中...</Text>
          ) : null
        }
        onEndReached={() => {
          if (orders.hasNextPage && !orders.isFetchingNextPage)
            void orders.fetchNextPage();
        }}
        onEndReachedThreshold={0.35}
        renderItem={({ item }) => (
          <OrderCard
            item={item}
            actionPending={pendingOrderId === item.id}
            onAction={handleOrderAction}
            onPress={(order) => {
              if (order.requestNo)
                router.push(
                  `/order/dispatch/${encodeURIComponent(order.requestNo)}`,
                );
              else router.push(`/order/${order.id}?scope=${scope}`);
            }}
          />
        )}
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
      <OrderReviewSheet
        visible={Boolean(reviewTarget)}
        readonly={Boolean(reviewTarget?.reviewExists)}
        detail={reviewDetail}
        onClose={() => setReviewTarget(null)}
        onSubmit={async (rating, content) => {
          if (!reviewTarget || !token) return;
          await submitOrderReview(
            reviewTarget.orderNo || reviewTarget.id,
            rating,
            content,
            token,
          );
          setReviewTarget((current) =>
            current ? { ...current, reviewExists: true } : current,
          );
          setReviewDetail({ rating, content });
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
      <AppPrompt
        visible={completePromptVisible && scope !== "accept"}
        title="提示"
        message={`确定完成订单吗，订单号：${completeTarget?.orderNo ?? completeTarget?.id ?? ""}`}
        cancelText="取消"
        confirmText="确认"
        onCancel={() => setCompletePromptVisible(false)}
        onConfirm={confirmComplete}
      />
      {completeTarget ? (
        <OrderCompleteConfirmSheet
          visible={completePromptVisible && scope === "accept"}
          order={completeTarget}
          companionName={
            completeTarget.receiverName || currentUser?.nickname || "陪玩师"
          }
          companionAvatar={
            completeTarget.receiverAvatar ??
            (currentUser?.headImage
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
            (currentUser?.headImage
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
          setPayTarget(null);
          if (!target || !token || cancelingPaymentRef.current) return;
          cancelingPaymentRef.current = true;
          void cancelOrderRequest(target.id, token)
            .then(async () => {
              if (currentUser?.id) {
                // 关闭支付即取消：取消后以详情为准就地刷新该单卡片。
                await refreshOrderAfterAction(target.id, token, currentUser.id);
              } else {
                await invalidateOrderQueries(target.id);
              }
            })
            .catch((error) =>
              setPrompt({
                title: "取消订单失败",
                message: error instanceof Error ? error.message : "请稍后重试",
              }),
            )
            .finally(() => {
              cancelingPaymentRef.current = false;
            });
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
            router.push({
              pathname: "/chat/[id]",
              params: {
                id: String(paid.receiverUserId),
                title: paid.receiverName || "用户聊天",
                avatar:
                  paid.receiverAvatar && "uri" in paid.receiverAvatar
                    ? String(paid.receiverAvatar.uri)
                    : "",
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

function StarPaymentPrompt({
  item,
  token,
  onClose,
  onPaid,
  onPaymentFailed,
}: {
  item: OrderItemModel | null;
  token: string | null;
  onClose: () => void | Promise<void>;
  onPaid: () => void;
  onPaymentFailed: (message: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [balance, setBalance] = useState<number | null>(null);
  const [paying, setPaying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const settledRef = useRef(false);

  useEffect(() => {
    if (item && token)
      void fetchStarBalance(token)
        .then(setBalance)
        .catch((error: Error) => setMessage(error.message));
  }, [item, token]);

  const pay = async () => {
    if (!item || !token) return;
    const total = Number(item.totalPrice) || 0;
    if ((balance ?? 0) < total) {
      setMessage("当前星钻余额不足，请充值后再支付");
      return;
    }
    setPaying(true);
    try {
      await payCompanionOrder(Number(item.id), token);
      settledRef.current = true;
      onPaid();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "支付失败";
      onPaymentFailed(errorMessage);
      if (!settledRef.current) {
        settledRef.current = true;
        await onClose();
      }
    } finally {
      setPaying(false);
    }
  };

  return (
    <>
      <BottomSheet
        scrollable
        visible={Boolean(item)}
        onClose={() => void onClose()}
        contentStyle={[
          styles.paymentSheet,
          { paddingBottom: 24 + insets.bottom },
        ]}
      >
        <Text style={styles.paymentTitle}>星钻支付</Text>
        <Text style={styles.paymentAmount}>
          支付 {item?.totalPrice ?? 0} 星钻
        </Text>
        <Text style={styles.paymentBalance}>
          当前余额：{balance === null ? "加载中..." : `${balance} 星钻`}
        </Text>
        <View style={styles.paymentActions}>
          <Pressable
            style={styles.paymentCancel}
            onPress={() => void onClose()}
          >
            <Text>取消</Text>
          </Pressable>
          <Pressable
            style={styles.paymentConfirm}
            disabled={paying || balance === null}
            onPress={() => void pay()}
          >
            <Text style={styles.paymentConfirmText}>
              {paying ? "支付中..." : "确认支付"}
            </Text>
          </Pressable>
        </View>
      </BottomSheet>
      <AppPrompt
        visible={Boolean(message)}
        title="支付提示"
        message={message ?? ""}
        onConfirm={() => setMessage(null)}
      />
    </>
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
  listFooter: {
    paddingVertical: 16,
    color: "#999",
    fontSize: 12,
    textAlign: "center",
  },
  paymentSheet: {
    padding: 24,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: "#fff",
  },
  paymentTitle: {
    color: "#111",
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },
  paymentAmount: {
    marginTop: 24,
    color: "#111",
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  paymentBalance: {
    marginTop: 12,
    color: "#777",
    fontSize: 14,
    textAlign: "center",
  },
  paymentActions: { flexDirection: "row", gap: 12, marginTop: 24 },
  paymentCancel: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F5F5F5",
  },
  paymentConfirm: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FF3158",
  },
  paymentConfirmText: { color: "#fff", fontWeight: "600" },
});
