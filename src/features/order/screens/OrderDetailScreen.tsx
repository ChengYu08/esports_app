import { useAuthStore } from "@esports/auth";
import { ChevronLeft24Regular } from "@fluentui/react-native-icons";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { OrderAfterSaleSheet } from "@/features/order/components/OrderAfterSaleSheet";
import { OrderCompleteConfirmSheet } from "@/features/order/components/OrderCompleteConfirmSheet";
import { OrderDetailBottomBar } from "@/features/order/components/OrderDetailBottomBar";
import { OrderDetailInfoBlocks } from "@/features/order/components/OrderDetailInfoBlocks";
import { OrderProgressSteps } from "@/features/order/components/OrderProgressSteps";
import { OrderDetailStatusBar } from "@/features/order/components/OrderDetailStatusBar";
import { OrderReviewSheet } from "@/features/order/components/OrderReviewSheet";
import { formatOrderTime } from "@/features/order/order-detail-format";
import { getOrderDetailAction } from "@/features/order/order-detail-actions";
import { useOrderDetailActions } from "@/features/order/hooks/use-order-detail-actions";
import {
  orderDetailQueryKey,
} from "@/features/order/order-query";
import {
  fetchOrderDetail,
  mapOrder,
} from "@/features/order/order.api";
import { DOUYIN_SANS } from "@/shared/theme/typography";
import { AppPrompt } from "@/shared/ui/AppPrompt";

/** 详情页只有接单方/下单方两种视角 */
type OrderDetailScope = "accept" | "place";

export function OrderDetailScreen({
  id,
  scope,
}: {
  id: string;
  scope: OrderDetailScope;
}) {
  const insets = useSafeAreaInsets();
  const token = useAuthStore((state) => state.accessToken);
  const currentUser = useAuthStore((state) => state.user);
  const detail = useQuery({
    queryKey: orderDetailQueryKey(id, scope),
    queryFn: async ({ signal }) =>
      mapOrder(await fetchOrderDetail(id, token as string, signal), 0, scope),
    enabled: Boolean(id && token),
    // 陪玩侧的接单/开始/完成随时推进订单；推送可能缺失（开始服务事件
    // 不一定下发 ORDER_NOTIFY），停留期间对活跃订单轮询兜底。
    refetchOnMount: "always",
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (
        status === "paid" ||
        status === "waitingService" ||
        status === "inService"
      ) {
        return 5_000;
      }
      return false;
    },
  });
  const actions = useOrderDetailActions({
    order: detail.data,
    scope,
    refetch: detail.refetch,
  });
  const [clock, setClock] = useState(() => Date.now());
  const dispatchDeadline = detail.data?.dispatchDeadline;
  useEffect(() => {
    if (scope !== "accept" || !dispatchDeadline) return;
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [dispatchDeadline, scope]);
  if (detail.isLoading)
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>订单详情加载中...</Text>
      </View>
    );
  if (detail.isError || !detail.data)
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>订单详情加载失败</Text>
        <Pressable onPress={() => void detail.refetch()}>
          <Text style={styles.retry}>点击重试</Text>
        </Pressable>
      </View>
    );
  const order = detail.data;
  const detailAction = getOrderDetailAction(order.actions);
  const detailActions =
    scope === "accept"
      ? order.actions
      : order.status === "completed"
        ? order.actions.filter((item) =>
            ["afterSales", "review", "reorder"].includes(item.key),
          )
        : detailAction
          ? order.actions.filter((item) => item.key === detailAction)
          : [];
  const isPending = order.status === "pendingPayment";
  const isCompleted = order.status === "completed";
  const isCancelled =
    order.status === "cancelled" || order.status === "refunded";
  const statusTitle =
    scope === "accept"
      ? order.status === "paid"
        ? "待陪玩师抢单"
        : order.status === "waitingService"
          ? "待服务"
          : order.status === "inService"
            ? "服务中"
            : order.status === "completed"
              ? "服务结束"
              : order.statusLabel
      : isPending
        ? "待支付"
        : order.statusLabel === "已支付"
          ? "进行中"
          : order.statusLabel;
  const deadlineTime = dispatchDeadline ? Date.parse(dispatchDeadline) : NaN;
  const dispatchCountdown = Number.isFinite(deadlineTime)
    ? Math.max(0, Math.ceil((deadlineTime - clock) / 1000))
    : undefined;
  const showDispatchCountdown =
    scope === "accept" &&
    (order.status === "paid" || order.status === "waitingService") &&
    dispatchCountdown !== undefined;
  const orderNumber = order.orderNo ?? order.id;
  const statusHint =
    scope === "accept"
      ? order.status === "paid"
        ? "老板已支付，请及时处理订单"
        : order.status === "waitingService"
          ? "请按约定时间开始服务"
          : order.status === "inService"
            ? "服务进行中"
            : isCompleted
              ? ""
              : isCancelled
                ? "订单已取消"
                : "订单状态已更新"
      : isPending
        ? "请在剩余时间内完成支付"
        : isCompleted
          ? "感谢你的支持"
          : isCancelled
            ? "订单已取消"
            : order.status === "inService"
              ? "服务进行中"
              : "陪玩确认后开始服务";

  return (
    <View style={[styles.screen, scope === "accept" && styles.acceptScreen]}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Pressable
          accessibilityLabel="返回"
          hitSlop={12}
          onPress={() => router.back()}
          style={styles.back}
        >
          <ChevronLeft24Regular
            color="#1A1A1A"
            width={24}
            height={24}
            style={styles.backIcon}
          />
        </Pressable>
        <View style={styles.headerTitle} />
        <View style={styles.headerSlot} />
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: (detailActions.length ? 148 : 24) + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <OrderDetailStatusBar
          scope={scope}
          statusTitle={statusTitle}
          statusHint={statusHint}
          showDispatchCountdown={showDispatchCountdown}
          dispatchCountdown={dispatchCountdown}
        />
        {!isCancelled && <OrderProgressSteps status={order.status} scope={scope} />}
        <OrderDetailInfoBlocks
          order={order}
          scope={scope}
          orderNumber={orderNumber}
          onCopy={() => void actions.copyOrderNumber()}
          onChat={actions.handleChat}
        />
      </ScrollView>
      <OrderDetailBottomBar
        scope={scope}
        actions={detailActions}
        pending={actions.actionPending}
        onAction={(action) => void actions.handleDetailAction(action)}
      />
      <AppPrompt
        visible={actions.cancelPromptVisible}
        title="提示"
        message={`确定取消订单吗，订单号：${order.orderNo ?? order.id}`}
        cancelText="取消"
        confirmText="确认"
        onCancel={() => actions.setCancelPromptVisible(false)}
        onConfirm={actions.confirmCancelOrder}
      />
      <OrderAfterSaleSheet
        visible={actions.afterSaleVisible}
        loading={actions.afterSaleLoading}
        members={actions.afterSaleMembers}
        onClose={() => actions.setAfterSaleVisible(false)}
        onContact={actions.contactAfterSaleMember}
      />
      <OrderReviewSheet
        visible={actions.reviewVisible}
        readonly={Boolean(order.reviewExists)}
        detail={actions.reviewDetail}
        onClose={() => actions.setReviewVisible(false)}
        onSubmit={actions.submitReview}
      />
      <AppPrompt
        visible={actions.completePromptVisible && scope !== "accept"}
        title="提示"
        message={`确定${scope === "accept" ? "完成服务" : "完成订单"}吗，订单号：${order.orderNo ?? order.id}`}
        cancelText="取消"
        confirmText="确认"
        onCancel={() => actions.setCompletePromptVisible(false)}
        onConfirm={actions.confirmCompletePlace}
      />
      <OrderCompleteConfirmSheet
        visible={actions.completePromptVisible && scope === "accept"}
        order={order}
        companionName={order.receiverName || currentUser?.nickname || "陪玩师"}
        companionAvatar={
          order.receiverAvatar ??
          (currentUser?.headImage ? { uri: currentUser.headImage } : undefined)
        }
        serviceTime={formatOrderTime(
          order.serviceStartTime || order.serviceEndTime || order.createTime,
        )}
        loading={actions.actionPending}
        onClose={() => {
          if (!actions.actionPending) actions.setCompletePromptVisible(false);
        }}
        onConfirm={actions.confirmCompleteAccept}
      />
      <AppPrompt
        visible={actions.actionPrompt === "reject"}
        title="确认拒绝接单"
        message="确认拒绝这笔订单吗？"
        cancelText="取消"
        confirmText="确认"
        onCancel={() => actions.setActionPrompt(null)}
        onConfirm={actions.confirmRejectOrder}
      />
      {actions.actionPrompt === "free" ? (
        <OrderCompleteConfirmSheet
          mode="free"
          visible
          order={order}
          companionName={order.receiverName || currentUser?.nickname || "陪玩师"}
          companionAvatar={
            order.receiverAvatar ??
            (currentUser?.headImage ? { uri: currentUser.headImage } : undefined)
          }
          serviceTime={formatOrderTime(
            order.serviceStartTime || order.serviceEndTime || order.createTime,
          )}
          loading={actions.actionPending}
          onClose={() => {
            if (!actions.actionPending) actions.setActionPrompt(null);
          }}
          onConfirm={(freeHours) => {
            void actions.runFreeOrder(freeHours);
          }}
        />
      ) : null}
      <AppPrompt
        visible={Boolean(actions.prompt)}
        title={actions.prompt?.title}
        message={actions.prompt?.message ?? ""}
        onConfirm={() => actions.setPrompt(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFF" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#FFF",
  },
  retry: { color: "#FF3158", fontSize: 15 },
  header: {
    minHeight: 88,
    backgroundColor: "#FFF",
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  back: { width: 32, alignItems: "flex-start" },
  backIcon: { width: 24, height: 24 },
  headerTitle: { width: 32 },
  headerSlot: { width: 32 },
  content: { paddingBottom: 148 },
  muted: { color: "#999", fontFamily: DOUYIN_SANS, fontSize: 13 },
  acceptScreen: { backgroundColor: "#F7F7F7" },
});
