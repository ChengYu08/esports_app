import { useEffect, useRef, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from "@esports/auth";
import { AppPrompt } from "@/shared/ui/AppPrompt";

import { EmptyState, ErrorState, LoadingState } from "@/shared/ui/AsyncStates";
import { OrderCard } from "../components/OrderCard";
import { OrderAfterSaleSheet } from "../components/OrderAfterSaleSheet";
import { OrderHeader } from "../components/OrderHeader";
import { OrderTabs } from "../components/OrderTabs";
import { useOrderPage } from "../hooks/use-order-page";
import { cancelOrder as cancelOrderRequest, completeOrder as completeOrderRequest, fetchAfterSaleMembers, type AfterSaleMember } from "../order.api";
import { fetchStarBalance, payCompanionOrder } from "@/features/mine/api/companion-order.api";
import type {
  OrderActionKey,
  OrderFilter,
  OrderItemModel,
} from "../order.types";

export default function OrderScreen() {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<OrderFilter>("all");
  const orders = useOrderPage(filter);
  const token = useAuthStore((state) => state.accessToken);
  const [cancelTarget, setCancelTarget] = useState<OrderItemModel | null>(null);
  const [completeTarget, setCompleteTarget] = useState<OrderItemModel | null>(null);
  const [afterSaleTarget, setAfterSaleTarget] = useState<OrderItemModel | null>(null);
  const [afterSaleMembers, setAfterSaleMembers] = useState<AfterSaleMember[]>([]);
  const [afterSaleLoading, setAfterSaleLoading] = useState(false);
  const [payTarget, setPayTarget] = useState<OrderItemModel | null>(null);
  const [prompt, setPrompt] = useState<{ title: string; message: string; confirmText?: string } | null>(null);
  const cancelingPaymentRef = useRef(false);
  const items = orders.data?.items ?? [];

  const handleOrderAction = async (item: OrderItemModel, action: OrderActionKey) => {
    if (action === "pay") {
      setPayTarget(item);
      return;
    }
    if (action === "cancel") setCancelTarget(item);
    if (action === "complete") setCompleteTarget(item);
    if (action === "afterSales") {
      setAfterSaleTarget(item);
      if (token && item.clubId) {
        setAfterSaleLoading(true);
        void fetchAfterSaleMembers(item.clubId, token).then(setAfterSaleMembers).catch(() => setAfterSaleMembers([])).finally(() => setAfterSaleLoading(false));
      } else setAfterSaleMembers([]);
    }
  };

  const confirmCancel = async () => {
    if (!cancelTarget || !token) return;
    const target = cancelTarget;
    setCancelTarget(null);
    try {
      await cancelOrderRequest(target.id, token);
      await orders.refetch();
    } catch (error) {
      setPrompt({ title: "取消订单失败", message: error instanceof Error ? error.message : "请稍后重试" });
    }
  };

  const confirmComplete = async () => {
    if (!completeTarget || !token) return;
    const target = completeTarget;
    setCompleteTarget(null);
    try {
      await completeOrderRequest(target.id, token);
      await orders.refetch();
    } catch (error) {
      setPrompt({ title: "完成订单失败", message: error instanceof Error ? error.message : "请稍后重试" });
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <OrderHeader />
      <OrderTabs onChange={setFilter} value={filter} />
      <FlatList
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 80 + insets.bottom },
        ]}
        data={items}
        ItemSeparatorComponent={OrderSeparator}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={orders.isLoading ? <LoadingState /> : orders.isError ? <ErrorState onRetry={() => void orders.refetch()} /> : <View style={styles.empty}><EmptyState message={filter === "all" ? "暂无订单" : `暂无${filter === "inProgress" ? "进行中" : filter === "completed" ? "已完成" : "已取消"}订单`} /></View>}
        renderItem={({ item }) => (
          <OrderCard item={item} onAction={handleOrderAction} onPress={(order) => router.push(`/order/${order.id}`)} />
        )}
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
        const payload = { orderId: Number(order?.id), orderNo: order?.orderNo, companionUserId: Number(order?.receiverUserId) || undefined, companionNickname: order?.sellerName, gameName: order?.gameName, serviceDesc: order?.serviceName, unitPrice: Number(order?.unitPrice), quantity: order?.quantity, totalPrice: Number(order?.totalPrice), createTime: order?.createTime, clubId: order?.clubId, csUserId: member.userId };
        router.push({ pathname: "/chat/[id]", params: { id: String(member.userId), title: member.nickname || "售后客服", avatar: member.headImage || "", afterSale: JSON.stringify(payload) } });
      }} />
      <AppPrompt
        visible={Boolean(completeTarget)}
        title="提示"
        message={`确定完成订单吗，订单号：${completeTarget?.orderNo ?? completeTarget?.id ?? ""}`}
        cancelText="取消"
        confirmText="确认"
        onCancel={() => setCompleteTarget(null)}
        onConfirm={() => void confirmComplete()}
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
            .then(() => orders.refetch())
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
    <Modal animationType="slide" transparent visible={Boolean(item)} onRequestClose={() => void onClose()}>
      <View style={styles.paymentBackdrop}>
        <View style={styles.paymentSheet}>
          <Text style={styles.paymentTitle}>星钻支付</Text>
          <Text style={styles.paymentAmount}>支付 {item?.totalPrice ?? 0} 星钻</Text>
          <Text style={styles.paymentBalance}>当前余额：{balance === null ? "加载中..." : `${balance} 星钻`}</Text>
          <View style={styles.paymentActions}>
            <Pressable style={styles.paymentCancel} onPress={() => void onClose()}><Text>取消</Text></Pressable>
            <Pressable style={styles.paymentConfirm} disabled={paying || balance === null} onPress={() => void pay()}><Text style={styles.paymentConfirmText}>{paying ? "支付中..." : "确认支付"}</Text></Pressable>
          </View>
        </View>
      </View>
    </Modal>
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
  paymentBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.48)" },
  paymentSheet: { padding: 24, borderTopLeftRadius: 20, borderTopRightRadius: 20, backgroundColor: "#fff" },
  paymentTitle: { color: "#111", fontSize: 18, fontWeight: "600", textAlign: "center" },
  paymentAmount: { marginTop: 24, color: "#111", fontSize: 22, fontWeight: "700", textAlign: "center" },
  paymentBalance: { marginTop: 12, color: "#777", fontSize: 14, textAlign: "center" },
  paymentActions: { flexDirection: "row", gap: 12, marginTop: 24 },
  paymentCancel: { flex: 1, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "#F5F5F5" },
  paymentConfirm: { flex: 1, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "#FF3158" },
  paymentConfirmText: { color: "#fff", fontWeight: "600" },
});
