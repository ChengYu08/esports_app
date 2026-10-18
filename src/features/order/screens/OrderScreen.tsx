import { useEffect, useRef, useState } from "react";
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from "@esports/auth";
import { AppPrompt } from "@/shared/ui/AppPrompt";
import { BottomSheet } from "@/shared/ui/BottomSheet";

import { EmptyState, ErrorState, LoadingState } from "@/shared/ui/AsyncStates";
import { OrderCard } from "../components/OrderCard";
import { OrderAfterSaleSheet } from "../components/OrderAfterSaleSheet";
import { OrderCompleteConfirmSheet } from "../components/OrderCompleteConfirmSheet";
import { buildAfterSalePayload } from "../after-sale-card";
import { OrderReviewSheet } from "../components/OrderReviewSheet";
import { OrderHeader } from "../components/OrderHeader";
import { OrderScopeTabs } from "../components/OrderScopeTabs";
import { OrderTabs } from "../components/OrderTabs";
import { useOrderPage } from "../hooks/use-order-page";
import { invalidateOrderQueries } from "../order-query";
import { acceptOrder, cancelOrder as cancelOrderRequest, completeOrder as completeOrderRequest, fetchAfterSaleMembers, fetchOrderReview, freeOrderService, rejectOrder, startOrderService, submitOrderReview, type AfterSaleMember, type OrderReview } from "../order.api";
import { grabDispatchRequest } from "../dispatch.api";
import { fetchStarBalance, payCompanionOrder } from "@/features/mine/api/companion-order.api";
import type {
  OrderActionKey,
  OrderFilter,
  OrderItemModel,
} from "../order.types";

export default function OrderScreen() {
  const insets = useSafeAreaInsets();
  const isCompanion = useAuthStore((state) => state.isCompanion);
  const [selectedScope, setSelectedScope] = useState<"dispatch" | "accept" | "place">(() => isCompanion ? "dispatch" : "place");
  const [filter, setFilter] = useState<OrderFilter>(() => isCompanion ? "grabbing" : "all");
  const scope = isCompanion ? selectedScope : "place";
  const visibleFilter = scope === "dispatch"
    ? filter === "history" ? "history" : "grabbing"
    : filter === "grabbing" || filter === "history" ? "all" : filter;
  const orders = useOrderPage(scope, visibleFilter);
  const token = useAuthStore((state) => state.accessToken);
  const currentUser = useAuthStore((state) => state.user);
  const [cancelTarget, setCancelTarget] = useState<OrderItemModel | null>(null);
  const [completeTarget, setCompleteTarget] = useState<OrderItemModel | null>(null);
  const [completePromptVisible, setCompletePromptVisible] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [afterSaleTarget, setAfterSaleTarget] = useState<OrderItemModel | null>(null);
  const [afterSaleMembers, setAfterSaleMembers] = useState<AfterSaleMember[]>([]);
  const [afterSaleLoading, setAfterSaleLoading] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<OrderItemModel | null>(null);
  const [reviewDetail, setReviewDetail] = useState<OrderReview | null>(null);
  const [payTarget, setPayTarget] = useState<OrderItemModel | null>(null);
  const [freeTarget, setFreeTarget] = useState<OrderItemModel | null>(null);
  const [prompt, setPrompt] = useState<{ title: string; message: string; confirmText?: string } | null>(null);
  const cancelingPaymentRef = useRef(false);
  const items = orders.data?.pages.flatMap((page) => page.items) ?? [];
  const emptyMessage = scope === "dispatch"
    ? visibleFilter === "history" ? "暂无抢单记录" : "暂无可抢需求"
    : visibleFilter === "all" ? "暂无订单"
      : `暂无${visibleFilter === "inProgress" ? "进行中" : visibleFilter === "completed" ? "已完成" : "已取消"}订单`;

  const handleOrderAction = async (item: OrderItemModel, action: OrderActionKey) => {
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
      try {
        await grabDispatchRequest(item.requestNo, token);
        await orders.refetch();
      } catch (error) {
        setPrompt({ title: "抢单失败", message: error instanceof Error ? error.message : "请稍后重试" });
      }
    }
    if ((action === "accept" || action === "reject" || action === "start") && token) {
      try {
        if (action === "accept") await acceptOrder(item.id, token);
        if (action === "reject") await rejectOrder(item.id, token);
        if (action === "start") await startOrderService(item.id, token);
        await invalidateOrderQueries(item.id);
        await orders.refetch();
      } catch (error) {
        setPrompt({ title: "订单操作失败", message: error instanceof Error ? error.message : "请稍后重试" });
      }
    }
    if (action === "afterSales") {
      if (item.clubId == null) {
        Alert.alert("暂无法申请售后", "缺少俱乐部信息，无法申请售后");
        return;
      }
      setAfterSaleTarget(item);
      if (token && item.clubId) {
        setAfterSaleLoading(true);
        void fetchAfterSaleMembers(item.clubId, token).then(setAfterSaleMembers).catch(() => setAfterSaleMembers([])).finally(() => setAfterSaleLoading(false));
      } else setAfterSaleMembers([]);
    }
    if (action === "review") {
      setReviewTarget(item);
      setReviewDetail(null);
      if (item.reviewId && token) void fetchOrderReview(item.reviewId, token).then(setReviewDetail).catch(() => undefined);
    }
    if (action === "reorder") router.push({ pathname: "/profile", params: { clubId: String(item.clubId || ""), userId: String(item.receiverUserId || "") } });
  };

  const confirmCancel = async () => {
    if (!cancelTarget || !token) return;
    const target = cancelTarget;
    setCancelTarget(null);
    try {
      await cancelOrderRequest(target.id, token);
      await invalidateOrderQueries(target.id);
      await orders.refetch();
    } catch (error) {
      setPrompt({ title: "取消订单失败", message: error instanceof Error ? error.message : "请稍后重试" });
    }
  };

  const confirmComplete = async () => {
    if (!completeTarget || !token || completing) return;
    const target = completeTarget;
    if (scope !== "accept") setCompletePromptVisible(false);
    setCompleting(true);
    try {
      await completeOrderRequest(target.id, token);
      setCompletePromptVisible(false);
      await invalidateOrderQueries(target.id);
      await orders.refetch();
    } catch (error) {
      setPrompt({ title: "完成订单失败", message: error instanceof Error ? error.message : "请稍后重试" });
    } finally {
      setCompleting(false);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <OrderHeader title={isCompanion ? "派单中心" : "订单"} />
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
      <FlatList
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 80 + insets.bottom },
        ]}
        data={items}
        ItemSeparatorComponent={OrderSeparator}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={orders.isLoading ? <LoadingState /> : orders.isError ? <ErrorState onRetry={() => void orders.refetch()} /> : <View style={styles.empty}><EmptyState message={emptyMessage} /></View>}
        ListFooterComponent={orders.isFetchingNextPage ? <Text style={styles.listFooter}>加载中...</Text> : null}
        onEndReached={() => { if (orders.hasNextPage && !orders.isFetchingNextPage) void orders.fetchNextPage(); }}
        onEndReachedThreshold={0.35}
        renderItem={({ item }) => (
          <OrderCard
            item={item}
            onAction={handleOrderAction}
            onPress={(order) => {
              if (order.requestNo) router.push(`/order/dispatch/${encodeURIComponent(order.requestNo)}`);
              else router.push(`/order/${order.id}?scope=${scope}`);
            }}
          />
        )}
        refreshControl={<RefreshControl refreshing={orders.isRefetching} onRefresh={() => void orders.refetch()} tintColor="#ff214b" />}
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
      <OrderAfterSaleSheet visible={Boolean(afterSaleTarget)} loading={afterSaleLoading} members={afterSaleMembers} onClose={() => setAfterSaleTarget(null)} onContact={(member) => {
        const order = afterSaleTarget;
        setAfterSaleTarget(null);
        if (!order) return;
        const payload = buildAfterSalePayload(order, member.userId);
        router.push({ pathname: "/chat/[id]", params: { id: String(member.userId), title: member.nickname || "售后客服", avatar: member.headImage || "", afterSale: JSON.stringify(payload) } });
      }} />
      <OrderReviewSheet visible={Boolean(reviewTarget)} readonly={Boolean(reviewTarget?.reviewExists)} detail={reviewDetail} onClose={() => setReviewTarget(null)} onSubmit={async (rating, content) => { if (!reviewTarget || !token) return; await submitOrderReview(reviewTarget.orderNo || reviewTarget.id, rating, content, token); setReviewTarget((current) => current ? { ...current, reviewExists: true } : current); setReviewDetail({ rating, content }); await orders.refetch(); }} />
      <AppPrompt
        visible={completePromptVisible && scope !== "accept"}
        title="提示"
        message={`确定完成订单吗，订单号：${completeTarget?.orderNo ?? completeTarget?.id ?? ""}`}
        cancelText="取消"
        confirmText="确认"
        onCancel={() => setCompletePromptVisible(false)}
        onConfirm={() => void confirmComplete()}
      />
      {completeTarget ? (
        <OrderCompleteConfirmSheet
          visible={completePromptVisible && scope === "accept"}
          order={completeTarget}
          companionName={completeTarget.receiverName || currentUser?.nickname || "陪玩师"}
          companionAvatar={completeTarget.receiverAvatar ?? (currentUser?.headImage ? { uri: currentUser.headImage } : undefined)}
          serviceTime={(completeTarget.serviceStartTime || completeTarget.serviceEndTime || completeTarget.createTime || "-").replace("T", " ").slice(0, 19)}
          loading={completing}
          onClose={() => {
            if (!completing) setCompletePromptVisible(false);
          }}
          onConfirm={() => void confirmComplete()}
        />
      ) : null}
      <AppPrompt
        visible={Boolean(freeTarget)}
        title="确认免单"
        message={`确认免单 ${freeTarget?.totalPrice ?? "0"} 星钻吗？`}
        cancelText="取消"
        confirmText="确认"
        onCancel={() => setFreeTarget(null)}
        onConfirm={() => {
          const target = freeTarget;
          setFreeTarget(null);
          if (!target || !token) return;
          void freeOrderService(target.id, Number(target.totalPrice) || 0, token)
            .then(async () => {
              await invalidateOrderQueries(target.id);
              await orders.refetch();
            })
            .catch((error) => setPrompt({ title: "免单失败", message: error instanceof Error ? error.message : "请稍后重试" }));
        }}
      />
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
              await invalidateOrderQueries(target.id);
              await orders.refetch();
            })
            .catch((error) => setPrompt({ title: "取消订单失败", message: error instanceof Error ? error.message : "请稍后重试" }))
            .finally(() => { cancelingPaymentRef.current = false; });
        }}
        onPaid={() => {
          setPayTarget(null);
          void orders.refetch();
          setPrompt({ title: "支付成功", message: "订单已支付，可在订单页面查看进度" });
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
  const [balance, setBalance] = useState<number | null>(null);
  const [paying, setPaying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const settledRef = useRef(false);

  useEffect(() => {
    if (item && token) void fetchStarBalance(token).then(setBalance).catch((error: Error) => setMessage(error.message));
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

  return <>
    <BottomSheet visible={Boolean(item)} onClose={() => void onClose()} contentStyle={styles.paymentSheet}>
          <Text style={styles.paymentTitle}>星钻支付</Text>
          <Text style={styles.paymentAmount}>支付 {item?.totalPrice ?? 0} 星钻</Text>
          <Text style={styles.paymentBalance}>当前余额：{balance === null ? "加载中..." : `${balance} 星钻`}</Text>
          <View style={styles.paymentActions}>
            <Pressable style={styles.paymentCancel} onPress={() => void onClose()}><Text>取消</Text></Pressable>
            <Pressable style={styles.paymentConfirm} disabled={paying || balance === null} onPress={() => void pay()}><Text style={styles.paymentConfirmText}>{paying ? "支付中..." : "确认支付"}</Text></Pressable>
          </View>
    </BottomSheet>
    <AppPrompt visible={Boolean(message)} title="支付提示" message={message ?? ""} onConfirm={() => setMessage(null)} />
  </>;
}

function OrderSeparator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F7F7" },
  content: { flexGrow: 1, paddingTop: 8 },
  separator: { height: 8 },
  empty: { flex: 1, minHeight: 320, alignItems: "center", justifyContent: "center" },
  listFooter: { paddingVertical: 16, color: "#999", fontSize: 12, textAlign: "center" },
  paymentSheet: { padding: 24, borderTopLeftRadius: 20, borderTopRightRadius: 20, backgroundColor: "#fff" },
  paymentTitle: { color: "#111", fontSize: 18, fontWeight: "600", textAlign: "center" },
  paymentAmount: { marginTop: 24, color: "#111", fontSize: 22, fontWeight: "700", textAlign: "center" },
  paymentBalance: { marginTop: 12, color: "#777", fontSize: 14, textAlign: "center" },
  paymentActions: { flexDirection: "row", gap: 12, marginTop: 24 },
  paymentCancel: { flex: 1, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "#F5F5F5" },
  paymentConfirm: { flex: 1, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "#FF3158" },
  paymentConfirmText: { color: "#fff", fontWeight: "600" },
});
