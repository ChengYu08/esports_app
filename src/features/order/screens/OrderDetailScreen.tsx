import { StarPaymentPrompt } from "@/features/order/components/StarPaymentPrompt";
import { getPaymentDeadline } from "@/features/order/payment-countdown";
import { showToast } from "@/shared/ui/app-toast";
import { useAuthStore } from "@esports/auth";
import { ChevronLeft24Regular } from "@fluentui/react-native-icons";
import { useQueries, useQuery } from "@tanstack/react-query";
import { router, useFocusEffect, useIsFocused } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fetchProfileDetail } from "@/features/mine/api/profile.api";
import { useCustomerServiceEntry } from "@/features/mine/hooks/use-customer-service-entry";
import { OrderAfterSaleSheet } from "@/features/order/components/OrderAfterSaleSheet";
import { OrderCompleteConfirmSheet } from "@/features/order/components/OrderCompleteConfirmSheet";
import { OrderDetailBottomBar } from "@/features/order/components/OrderDetailBottomBar";
import { OrderDetailInfoBlocks } from "@/features/order/components/OrderDetailInfoBlocks";
import { OrderDetailStatusBar } from "@/features/order/components/OrderDetailStatusBar";
import { OrderFreeConfirmFlow } from "@/features/order/components/OrderFreeConfirmFlow";
import { OrderMultiCompanionSheet } from "@/features/order/components/OrderMultiCompanionSheet";
import { OrderReviewSheet } from "@/features/order/components/OrderReviewSheet";
import { useOrderDetailActions } from "@/features/order/hooks/use-order-detail-actions";
import { multiCompanionNeedSelect } from "@/features/order/multi-companion";
import { getOrderDetailAction } from "@/features/order/order-detail-actions";
import { formatOrderTime } from "@/features/order/order-detail-format";
import {
    orderClubQueryKey,
    orderDetailQueryKey,
} from "@/features/order/order-query";
import {
    fetchOrderClub,
    fetchOrderDetail,
    mapOrder,
} from "@/features/order/order.api";
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
  const focused = useIsFocused();
  const token = useAuthStore((state) => state.accessToken);
  const currentUser = useAuthStore((state) => state.user);
  const { openCustomerService } = useCustomerServiceEntry();
  const detail = useQuery({
    queryKey: orderDetailQueryKey(id, scope),
    queryFn: async ({ signal }) =>
      mapOrder(await fetchOrderDetail(id, token as string, signal), 0, scope),
    enabled: Boolean(id && token),
    // 大神侧的接单/开始/完成随时推进订单；推送可能缺失（开始服务事件
    // 不一定下发 ORDER_NOTIFY），停留期间对活跃订单轮询兜底。
    refetchOnMount: "always",
    refetchInterval: (query) => {
      if (!focused) {
        return false;
      }
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
  const hasFocused = useRef(false);
  const refetchDetail = detail.refetch;
  // 评价弹窗跳转相册/预览时临时收起，返回本页（focus）时恢复
  const [reviewSuppressed, setReviewSuppressed] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setReviewSuppressed(false);
      if (!hasFocused.current) {
        hasFocused.current = true;
        return;
      }
      if (id && token) {
        void refetchDetail({ cancelRefetch: false });
      }
    }, [id, refetchDetail, token]),
  );
  const actions = useOrderDetailActions({
    order: detail.data,
    scope,
    refetch: detail.refetch,
  });
  // 详情接口只回 companionClubId，俱乐部名另查公开详情（有缓存）。
  const clubId = detail.data?.clubId;
  const clubQuery = useQuery({
    queryKey: orderClubQueryKey(clubId ?? 0),
    queryFn: ({ signal }) => fetchOrderClub(clubId as number, signal),
    enabled: clubId != null,
    staleTime: 10 * 60_000,
    retry: 1,
  });
  const [paymentVisible, setPaymentVisible] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const companionIds =
    scope === "place"
      ? [
          ...new Set(
            (detail.data?.companions ?? [])
              .map((companion) => companion.userId)
              .filter((userId) => /^\d+$/.test(userId) && userId !== "0"),
          ),
        ]
      : [];
  const companionProfiles = useQueries({
    queries: companionIds.map((userId) => ({
      queryKey: ["profile-detail", undefined, userId],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        fetchProfileDetail({ userId }, signal),
      staleTime: 10 * 60_000,
      retry: 1,
    })),
  });
  const companionClubs = Object.fromEntries(
    companionIds.map((userId, index) => {
      const profile = companionProfiles[index]?.data;
      return [
        userId,
        profile?.clubId
          ? {
              clubId: profile.clubId,
              clubName: profile.clubName,
              logoUrl: profile.logoUrl,
            }
          : undefined,
      ];
    }),
  );
  const [clock, setClock] = useState(() => Date.now());
  const dispatchDeadline = detail.data?.dispatchDeadline;
  useEffect(() => {
    if (!focused || scope !== "accept" || !dispatchDeadline) {
      return;
    }
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [dispatchDeadline, focused, scope]);
  if (detail.isLoading) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>订单详情加载中...</Text>
      </View>
    );
  }
  if (detail.isError || !detail.data) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>订单详情加载失败</Text>
        <Pressable
          onPress={() => {
            detail.refetch();
          }}
        >
          <Text style={styles.retry}>点击重试</Text>
        </Pressable>
      </View>
    );
  }
  const order = detail.data;
  const clubName = order.clubName ?? clubQuery.data?.name;
  const isCompleted =
    order.status === "completed" || order.status === "partiallyRefunded";
  const detailAction = getOrderDetailAction(order.actions);
  const detailActions =
    scope === "accept"
      ? isCompleted
        ? []
        : order.actions
      : isCompleted
        ? order.actions.filter((item) =>
            ["afterSales", "review", "reorder"].includes(item.key),
          )
        : detailAction
          ? order.actions
              .filter((item) => item.key === detailAction)
              .map((item) =>
                item.key === "pay" ? { ...item, label: "立即支付" } : item,
              )
          : [];
  const isPending = order.status === "pendingPayment";
  const statusTitle =
    scope === "accept"
      ? order.status === "paid"
        ? "待大神抢单"
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
    (order.status === "paid" ||
      order.status === "waitingService" ||
      order.status === "inService") &&
    dispatchCountdown !== undefined;
  const orderNumber = order.orderNo ?? order.id;
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
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: detailActions.length ? 8 : 24 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <OrderDetailStatusBar
          scope={scope}
          statusTitle={statusTitle}
          showDispatchCountdown={showDispatchCountdown}
          dispatchCountdown={dispatchCountdown}
        />
        <OrderDetailInfoBlocks
          order={order}
          scope={scope}
          clubName={clubName}
          clubLogoUrl={clubQuery.data?.logoUrl}
          companionClubs={companionClubs}
          orderNumber={orderNumber}
          onCopy={actions.copyOrderNumber}
          onChat={actions.handleChat}
        />
      </ScrollView>
      <OrderDetailBottomBar
        scope={scope}
        actions={detailActions}
        pending={actions.actionPending}
        onAction={(action) => {
          if (action.key === "pay") {
            const deadline = getPaymentDeadline(order);
            if (deadline !== null && Date.now() >= deadline) {
              showToast("订单支付已超时");
              detail.refetch();
              return;
            }
            setPaymentVisible(true);
            return;
          }
          actions.handleDetailAction(action);
        }}
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
        onCustomerService={openCustomerService}
      />
      <OrderMultiCompanionSheet
        visible={actions.multiSelectVisible}
        needSelect={multiCompanionNeedSelect(order)}
        candidates={actions.multiSelectCandidates}
        loading={actions.multiSelectLoading}
        submitting={actions.actionPending}
        onClose={() => actions.setMultiSelectVisible(false)}
        onConfirm={actions.confirmMultiCompanions}
      />
      <OrderReviewSheet
        visible={actions.reviewVisible && !reviewSuppressed}
        readonly={Boolean(order.reviewExists)}
        detail={actions.reviewDetail}
        onClose={() => actions.setReviewVisible(false)}
        onSuppress={() => setReviewSuppressed(true)}
        onSubmit={actions.submitReview}
      />
      <StarPaymentPrompt
        key={paymentVisible ? order.id : "none"}
        item={paymentVisible ? order : null}
        token={token}
        onClose={() => setPaymentVisible(false)}
        onPaid={() => {
          setPaymentVisible(false);
          detail.refetch();
        }}
        onPaymentFailed={setPaymentError}
      />
      <AppPrompt
        visible={!!paymentError}
        title="支付失败"
        message={paymentError}
        onConfirm={() => setPaymentError("")}
      />
      <OrderCompleteConfirmSheet
        visible={actions.completePromptVisible}
        order={order}
        buyerName={
          scope === "place" ? currentUser?.nickname || "用户" : undefined
        }
        buyerAvatar={
          scope === "place"
            ? currentUser?.headImage
              ? { uri: currentUser.headImage }
              : require("../../../../assets/images/avatar_default.webp")
            : undefined
        }
        companionName={
          order.receiverName ||
          (scope === "place" ? order.sellerName : currentUser?.nickname) ||
          "大神"
        }
        companionAvatar={
          order.receiverAvatar ??
          (scope === "accept" && currentUser?.headImage
            ? { uri: currentUser.headImage }
            : undefined)
        }
        serviceTime={formatOrderTime(
          order.serviceStartTime || order.serviceEndTime || order.createTime,
        )}
        loading={actions.actionPending}
        onClose={() => {
          if (!actions.actionPending) {
            actions.setCompletePromptVisible(false);
          }
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
        <OrderFreeConfirmFlow
          order={order}
          companionName={order.receiverName || currentUser?.nickname || "大神"}
          companionAvatar={
            order.receiverAvatar ??
            (scope === "accept" && currentUser?.headImage
              ? { uri: currentUser.headImage }
              : undefined)
          }
          loading={actions.actionPending}
          onClose={() => {
            if (!actions.actionPending) {
              actions.setActionPrompt(null);
            }
          }}
          onConfirm={actions.runFreeOrder}
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
  retry: { color: "#FE1F4C", fontSize: 15 },
  header: {
    backgroundColor: "#FFF",
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 12,
  },
  back: {
    width: 32,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  backIcon: { width: 24, height: 24 },
  headerTitle: { width: 32 },
  headerSlot: { width: 32 },
  scroll: { flex: 1 },
  content: { paddingBottom: 8 },
  muted: { color: "#999", fontSize: 13 },
  acceptScreen: { backgroundColor: "#F7F7F7" },
});
