import { useAuthStore } from "@esports/auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Toast from "react-native-root-toast";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { OrderAfterSaleSheet } from "@/features/order/components/OrderAfterSaleSheet";
import { OrderCompleteConfirmSheet } from "@/features/order/components/OrderCompleteConfirmSheet";
import { OrderReviewSheet } from "@/features/order/components/OrderReviewSheet";
import { getOrderDetailAction } from "@/features/order/order-detail-actions";
import { invalidateOrderQueries, orderDetailQueryKey } from "@/features/order/order-query";
import { buildAfterSalePayload } from "@/features/order/after-sale-card";
import {
  cancelOrder,
  completeOrder,
  acceptOrder,
  fetchAfterSaleMembers,
  fetchOrderDetail,
  fetchOrderReview,
  freeOrderService,
  mapOrder,
  rejectOrder,
  startOrderService,
  submitOrderReview,
  type AfterSaleMember,
  type OrderReview,
} from "@/features/order/order.api";
import type { OrderAction, OrderActionKey, OrderItemModel, OrderScope } from "@/features/order/order.types";
import { requireLogin } from "@/shared/navigation/require-login";
import { DOUYIN_SANS } from "@/shared/theme/typography";
import { AppPrompt } from "@/shared/ui/AppPrompt";
import { CachedImage } from "@/shared/ui/CachedImage";

const copyIcon = require("../../../assets/coms/copy.svg");
const backIcon = require("../../../assets/message/chat-back.svg");
const orderStepCheck = require("../../../assets/order/order-step-check.svg");
const orderStepActive = require("../../../assets/order/order-step-active.svg");
const orderStepPending = require("../../../assets/order/order-step-pending.svg");
const ACTION_GRADIENT = ["#FF2145", "#FF3158"] as const;

export default function OrderDetailRoute() {
  const { id, scope: scopeParam } = useLocalSearchParams<{ id: string; scope?: string }>();
  const scope: OrderScope = scopeParam === "accept" ? "accept" : "place";
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
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
  const [actionPrompt, setActionPrompt] = useState<"reject" | "free" | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [prompt, setPrompt] = useState<{
    title: string;
    message: string;
  } | null>(null);
  const detail = useQuery({
    queryKey: orderDetailQueryKey(id, scope),
    queryFn: async ({ signal }) => mapOrder(await fetchOrderDetail(id, token as string, signal), 0, scope),
    enabled: Boolean(id && token),
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
  const detailActions = scope === "accept"
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
  const statusTitle = scope === "accept"
    ? order.status === "paid" ? "待陪玩师抢单"
      : order.status === "waitingService" ? "待服务"
        : order.status === "inService" ? "服务中"
          : order.status === "completed" ? "服务结束"
            : order.statusLabel
    : isPending ? "待支付"
      : order.statusLabel === "已支付" ? "进行中" : order.statusLabel;
  const deadlineTime = dispatchDeadline ? Date.parse(dispatchDeadline) : NaN;
  const dispatchCountdown = Number.isFinite(deadlineTime)
    ? Math.max(0, Math.ceil((deadlineTime - clock) / 1000))
    : undefined;
  const showDispatchCountdown = scope === "accept"
    && (order.status === "paid" || order.status === "waitingService")
    && dispatchCountdown !== undefined;
  const orderNumber = order.orderNo ?? order.id;
  const handleChat = () => {
    if (!requireLogin()) return;
    const chatUserId = scope === "accept" ? order.buyerUserId : order.receiverUserId;
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
  const statusHint = scope === "accept"
    ? order.status === "paid" ? "老板已支付，请及时处理订单"
      : order.status === "waitingService" ? "请按约定时间开始服务"
        : order.status === "inService" ? "服务进行中"
          : isCompleted ? ""
            : isCancelled ? "订单已取消" : "订单状态已更新"
    : isPending
      ? "请在剩余时间内完成支付"
      : isCompleted
        ? "感谢你的支持"
        : isCancelled
          ? "订单已取消"
          : order.status === "inService"
            ? "服务进行中"
            : "陪玩确认后开始服务";
  const copyOrderNumber = async () => {
    try {
      await Clipboard.setStringAsync(orderNumber);
      Toast.show("订单编号已复制", { duration: Toast.durations.SHORT });
    } catch {
      Toast.show("复制失败，请稍后重试", { duration: Toast.durations.SHORT });
    }
  };

  const runAcceptAction = async (action: OrderActionKey) => {
    if (!token) return;
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
      await invalidateOrderQueries(order.id);
      await queryClient.invalidateQueries({ queryKey: ["orders", "accept"] });
      await detail.refetch();
      Toast.show("操作成功", { duration: Toast.durations.SHORT });
    } catch (error) {
      setPrompt({ title: "订单操作失败", message: error instanceof Error ? error.message : "请稍后重试" });
    } finally {
      setActionPending(false);
    }
  };

  const handleDetailAction = async (action: OrderAction) => {
    if (scope === "accept") {
      await runAcceptAction(action.key);
      return;
    }
    if (action.key === "cancel") setCancelPromptVisible(true);
    else if (action.key === "complete") setCompletePromptVisible(true);
    else if (action.key === "afterSales") {
      if (order.clubId == null) {
        Alert.alert("暂无法申请售后", "缺少俱乐部信息，无法申请售后");
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
        void fetchOrderReview(order.reviewId, token).then(setReviewDetail).catch(() => undefined);
    } else if (action.key === "reorder") {
      router.push({
        pathname: "/profile",
        params: { clubId: String(order.clubId || ""), userId: String(order.receiverUserId || "") },
      });
    }
  };

  return (
    <View style={[styles.screen, scope === "accept" && styles.acceptScreen]}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Pressable
          accessibilityLabel="返回"
          hitSlop={12}
          onPress={() => router.back()}
          style={styles.back}
        >
          <Image source={backIcon} style={styles.backIcon} />
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
        <View style={[styles.statusBlock, { height: 84, paddingTop: 12 }, scope === "accept" && styles.acceptStatusBlock]}>
          <Text style={[styles.statusTitle, scope === "accept" && styles.acceptStatusTitle]}>{statusTitle}</Text>
          {statusHint ? (
            <Text style={[styles.statusHint, { marginTop: 8, lineHeight: 22 }, scope === "accept" && styles.acceptStatusHint]}>
              {showDispatchCountdown
                ? dispatchCountdown === 0
                  ? "抢单已截止"
                  : <>剩余 <Text style={styles.countdownAccent}>{formatCountdown(dispatchCountdown ?? 0)}</Text> 停止抢单</>
                : statusHint}
            </Text>
          ) : null}
        </View>
        {!isCancelled && <ProgressSteps status={order.status} scope={scope} />}
        <View style={[styles.infoBlock, scope === "accept" && styles.acceptInfoBlock]}>
          <View style={styles.sellerRow}>
            <CachedImage
              contentFit="cover"
              source={order.sellerAvatar}
              style={styles.avatar}
            />
            <View style={styles.sellerCopy}>
              <Text style={[styles.sellerName, scope === "accept" && styles.acceptSellerName]}>{order.sellerName}</Text>
              {scope !== "accept" && <Text style={styles.muted}>盼之电竞自营俱乐部</Text>}
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={handleChat}
              style={[styles.chatButton, scope === "accept" && styles.acceptChatButton]}
            >
              <Text style={[styles.chatText, scope === "accept" && styles.acceptChatText]}>聊一聊</Text>
            </Pressable>
          </View>
          <View style={styles.divider} />
          <InfoRow acceptStyle={scope === "accept"} label="游戏" value={order.gameName} />
          <InfoRow acceptStyle={scope === "accept"} label="服务" value={order.serviceName.replace("服务", "")} />
          <InfoRow acceptStyle={scope === "accept"} label="备注" value={order.remark || "-"} multiline={scope === "accept"} />
          <InfoRow acceptStyle={scope === "accept"} label="单价" value={`${order.unitPrice}星钻/${order.billingUnitName ?? "小时"}`} />
          <InfoRow acceptStyle={scope === "accept"} label="个数" value={`x ${order.quantity}`} />
          <InfoRow acceptStyle={scope === "accept"} label={scope === "accept" ? "合计" : "实付款"} value={`${order.totalPrice}星钻`} />
        </View>
        <View style={[styles.infoBlock, scope === "accept" && styles.acceptDetailsBlock]}>
          <InfoRow acceptStyle={scope === "accept"} label="订单编号" value={orderNumber} copy onCopy={() => void copyOrderNumber()} />
          <InfoRow acceptStyle={scope === "accept"} label="创建时间" value={formatOrderTime(order.createTime)} />
          {scope === "accept" ? (
            <InfoRow acceptStyle label="派单时间" value={formatOrderTime(order.dispatchTime ?? order.acceptedTime)} />
          ) : (
            <>
              <InfoRow label="支付时间" value={formatOrderTime(order.paidTime)} />
              <InfoRow label="接单时间" value={formatOrderTime(order.acceptedTime)} />
              <InfoRow label="服务时间" value={formatServiceTime(order.serviceStartTime, order.serviceEndTime)} />
              <InfoRow label="完成时间" value={formatOrderTime(order.completedTime)} />
            </>
          )}
        </View>
      </ScrollView>
      {detailActions.length ? (
        <View
          style={[
            styles.bottom,
            scope === "accept" && styles.acceptBottom,
            { paddingBottom: Math.max(insets.bottom, 12) },
          ]}
        >
          {detailActions.map((action) => (
            <Pressable
              key={action.key}
              disabled={actionPending}
              onPress={() => void handleDetailAction(action)}
              style={[styles.outlineButton, scope === "accept" && styles.acceptOutlineButton, detailActions.length > 1 && styles.bottomAction, action.variant === "primary" && styles.primaryButton, action.variant === "primary" && scope === "accept" && styles.acceptPrimaryButton]}
            >
              {action.variant === "primary" ? (
                <LinearGradient colors={ACTION_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primaryGradient}>
                  <Text style={[styles.primaryText, scope === "accept" && styles.acceptActionText]}>{actionPending ? "处理中..." : action.label}</Text>
                </LinearGradient>
              ) : (
                <Text style={[styles.outlineText, scope === "accept" && styles.acceptActionText]}>{actionPending ? "处理中..." : action.label}</Text>
              )}
            </Pressable>
          ))}
        </View>
      ) : null}
      <AppPrompt
        visible={cancelPromptVisible}
        title="提示"
        message={`确定取消订单吗，订单号：${order.orderNo ?? order.id}`}
        cancelText="取消"
        confirmText="确认"
        onCancel={() => setCancelPromptVisible(false)}
        onConfirm={() => {
          setCancelPromptVisible(false);
          if (!token) return;
          void cancelOrder(String(order.id), token)
            .then(async () => {
              await invalidateOrderQueries(order.id);
              await detail.refetch();
            })
            .catch((error) => {
              setPrompt({
                title: "取消订单失败",
                message: error instanceof Error ? error.message : "请稍后重试",
              });
            });
        }}
      />
      <OrderAfterSaleSheet
        visible={afterSaleVisible}
        loading={afterSaleLoading}
        members={afterSaleMembers}
        onClose={() => setAfterSaleVisible(false)}
        onContact={(member) => {
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
        }}
      />
      <OrderReviewSheet
        visible={reviewVisible}
        readonly={Boolean(order.reviewExists)}
        detail={reviewDetail}
        onClose={() => setReviewVisible(false)}
        onSubmit={async (rating, content) => {
          if (!token) return;
          await submitOrderReview(
            order.orderNo || order.id,
            rating,
            content,
            token,
          );
          setReviewDetail({ rating, content });
          await detail.refetch();
        }}
      />
      <AppPrompt
        visible={completePromptVisible && scope !== "accept"}
        title="提示"
        message={`确定${scope === "accept" ? "完成服务" : "完成订单"}吗，订单号：${order.orderNo ?? order.id}`}
        cancelText="取消"
        confirmText="确认"
        onCancel={() => setCompletePromptVisible(false)}
        onConfirm={() => {
          setCompletePromptVisible(false);
          if (!token) return;
          void completeOrder(order.id, token)
            .then(async () => {
              await invalidateOrderQueries(order.id);
              await detail.refetch();
            })
            .catch((error) =>
              setPrompt({
                title: "完成订单失败",
                message: error instanceof Error ? error.message : "请稍后重试",
              }),
            );
        }}
      />
      <OrderCompleteConfirmSheet
        visible={completePromptVisible && scope === "accept"}
        order={order}
        companionName={order.receiverName || currentUser?.nickname || "陪玩师"}
        companionAvatar={order.receiverAvatar ?? (currentUser?.headImage ? { uri: currentUser.headImage } : undefined)}
        serviceTime={formatOrderTime(order.serviceStartTime || order.serviceEndTime || order.createTime)}
        loading={actionPending}
        onClose={() => {
          if (!actionPending) setCompletePromptVisible(false);
        }}
        onConfirm={async () => {
          if (!token || actionPending) return;
          setActionPending(true);
          try {
            await completeOrder(order.id, token);
            setCompletePromptVisible(false);
            await invalidateOrderQueries(order.id);
            await queryClient.invalidateQueries({ queryKey: ["orders", "accept"] });
            await detail.refetch();
            Toast.show("服务已完成", { duration: Toast.durations.SHORT });
          } catch (error) {
            setPrompt({
              title: "完成订单失败",
              message: error instanceof Error ? error.message : "请稍后重试",
            });
          } finally {
            setActionPending(false);
          }
        }}
      />
      <AppPrompt
        visible={actionPrompt !== null}
        title={actionPrompt === "free" ? "确认免单" : "确认拒绝接单"}
        message={actionPrompt === "free" ? `确认免单 ${order.totalPrice} 星钻吗？` : "确认拒绝这笔订单吗？"}
        cancelText="取消"
        confirmText="确认"
        onCancel={() => setActionPrompt(null)}
        onConfirm={() => {
          const action = actionPrompt;
          setActionPrompt(null);
          if (!token || !action) return;
          setActionPending(true);
          const operation = action === "free"
            ? freeOrderService(order.id, Number(order.totalPrice) || 0, token)
            : rejectOrder(order.id, token);
          void operation
            .then(async () => {
              await invalidateOrderQueries(order.id);
              await detail.refetch();
              Toast.show("操作成功", { duration: Toast.durations.SHORT });
            })
            .catch((error) => setPrompt({ title: action === "free" ? "免单失败" : "拒绝失败", message: error instanceof Error ? error.message : "请稍后重试" }))
            .finally(() => setActionPending(false));
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

function imageSourceUri(source: OrderItemModel["sellerAvatar"]) {
  if (typeof source === "string") return source;
  if (typeof source !== "object" || source === null || !("uri" in source)) return "";
  return typeof source.uri === "string" ? source.uri : "";
}

function ProgressSteps({ status, scope }: { status: OrderItemModel["status"]; scope: OrderScope }) {
  const labels = ["支付订单", scope === "accept" ? "陪玩抢单" : "陪玩确认", "陪玩服务", "服务完成"];
  const activeStep =
    status === "pendingPayment"
      ? 0
      : status === "paid"
        ? 1
        : status === "waitingService" || status === "inService"
          ? 2
          : 4;
  return (
    <View style={[styles.flow, scope === "accept" && styles.acceptFlow]}>
      <View style={styles.flowLine} />
      {labels.map((label, index) => {
        const done = index < activeStep;
        const active = index === activeStep;
        return (
          <View style={styles.flowStep} key={label}>
            <View
              style={[
                styles.flowMarker,
                scope === "accept" && styles.acceptFlowMarker,
                done && styles.flowMarkerDone,
                active && styles.flowMarkerActive,
              ]}
            >
              {done ? (
                scope === "accept"
                  ? <Image source={orderStepCheck} style={styles.acceptFlowIcon} />
                  : <Text style={styles.flowCheck}>✓</Text>
              ) : active ? (
                scope === "accept"
                  ? <Image source={orderStepActive} style={styles.acceptFlowIcon} />
                  : <View style={styles.flowActiveDot} />
              ) : scope === "accept" ? (
                <View style={styles.acceptPendingMarker}>
                  <Image source={orderStepPending} style={styles.acceptPendingIcon} />
                  <Text style={styles.acceptFlowNumber}>{index + 1}</Text>
                </View>
              ) : (
                <Text style={styles.flowNumber}>{index + 1}</Text>
              )}
            </View>
            <Text
              style={[
                styles.flowLabel,
                scope === "accept" && styles.acceptFlowLabel,
                index > activeStep && styles.flowLabelMuted,
              ]}
            >
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function InfoRow({
  label,
  value,
  copy,
  onCopy,
  acceptStyle = false,
  multiline = false,
}: {
  label: string;
  value: string;
  copy?: boolean;
  onCopy?: () => void;
  acceptStyle?: boolean;
  multiline?: boolean;
}) {
  return (
    <View style={[styles.infoRow, multiline && styles.multilineInfoRow]}>
      <Text style={[styles.label, acceptStyle && styles.acceptLabel]}>{label}</Text>
      <View style={styles.infoValue}>
        <Text style={[styles.value, (label === "实付款" || label === "合计") && styles.amount, acceptStyle && styles.acceptValue, multiline && styles.multilineValue]}>
          {value}
        </Text>
        {copy && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="复制订单编号"
            hitSlop={8}
            onPress={onCopy}
          >
            <Image source={copyIcon} style={styles.copy} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

function formatOrderTime(value?: string) {
  return value ? value.replace("T", " ").slice(0, 19) : "-";
}

function formatServiceTime(startTime?: string, endTime?: string) {
  const start = formatOrderTime(startTime);
  const end = formatOrderTime(endTime);
  if (start === "-") return end;
  if (end === "-") return start;
  return `${start} - ${end}`;
}

function formatCountdown(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}分${String(remainder).padStart(2, "0")}秒`;
}

const styles = StyleSheet.create({
  flow: {
    height: 74,
    flexDirection: "row",
    position: "relative",
    alignItems: "flex-start",
  },
  acceptFlow: { height: 74 },
  acceptFlowIcon: { width: 24, height: 24 },
  acceptPendingMarker: { width: 24, height: 24, alignItems: "center", justifyContent: "center" },
  acceptPendingIcon: { position: "absolute", width: 20, height: 20 },
  acceptFlowNumber: { color: "#FFF", fontFamily: DOUYIN_SANS, fontSize: 12, fontWeight: "500" },
  flowLine: {
    position: "absolute",
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#E4E4E4",
    left: "12.5%",
    right: "12.5%",
    top: 11,
  },
  flowStep: { flex: 1, alignItems: "center", zIndex: 1 },
  flowMarker: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#D1D1D1",
    alignItems: "center",
    justifyContent: "center",
  },
  acceptFlowMarker: { width: 24, height: 24, borderRadius: 12 },
  flowMarkerDone: { backgroundColor: "#E4FBF1" },
  flowMarkerActive: { backgroundColor: "#FFE9EE" },
  flowCheck: {
    color: "#13B979",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 20,
  },
  flowActiveDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: "#FF3150",
  },
  flowNumber: { color: "#FFF", fontSize: 14, fontWeight: "600" },
  flowLabel: {
    color: "#222",
    fontFamily: DOUYIN_SANS,
    fontSize: 13,
    marginTop: 9,
  },
  acceptFlowLabel: { fontSize: 12, marginTop: 7 },
  flowLabelMuted: { color: "#999" },
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
  statusBlock: { height: 158, paddingHorizontal: 16, paddingTop: 100 },
  statusTitle: {
    color: "#161616",
    fontFamily: DOUYIN_SANS,
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 34,
  },
  statusHint: {
    color: "#222",
    fontFamily: DOUYIN_SANS,
    fontSize: 16,
    marginTop: 26,
  },
  acceptScreen: { backgroundColor: "#F7F7F7" },
  acceptStatusBlock: { height: 82, paddingTop: 8 },
  acceptStatusTitle: { color: "#0A0A0A", fontSize: 24, lineHeight: 30 },
  acceptStatusHint: { color: "#0A0A0A", fontSize: 14, marginTop: 4 },
  countdownAccent: { color: "#FE1F4C" },
  steps: {
    height: 112,
    flexDirection: "row",
    paddingHorizontal: 32,
    paddingBottom: 27,
  },
  step: { flex: 1, alignItems: "center" },
  stepLine: {
    width: "100%",
    height: 28,
    flexDirection: "row",
    alignItems: "center",
  },
  connector: { flex: 1, height: 1, backgroundColor: "#E4E4E4" },
  hidden: { opacity: 0 },
  stepDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#D1D1D1",
    alignItems: "center",
    justifyContent: "center",
  },
  stepDone: { backgroundColor: "#E2FBF1" },
  stepActive: {
    backgroundColor: "#FFE9EE",
    borderWidth: 7,
    borderColor: "#FFE9EE",
  },
  stepNumber: { color: "#FFF", fontSize: 14, fontWeight: "600" },
  stepNumberActive: { color: "#FF254B" },
  stepLabel: {
    color: "#222",
    fontFamily: DOUYIN_SANS,
    fontSize: 13,
    marginTop: 9,
  },
  stepLabelMuted: { color: "#999" },
  infoBlock: {
    gap: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 14,
    borderTopColor: "#F7F7F7",
  },
  acceptInfoBlock: { borderTopWidth: 14 },
  acceptDetailsBlock: { borderTopWidth: 8, paddingVertical: 8 },
  sellerRow: { flexDirection: "row", alignItems: "center", minHeight: 58 },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 10 },
  sellerCopy: { flex: 1, gap: 4 },
  sellerName: {
    color: "#111",
    fontFamily: DOUYIN_SANS,
    fontSize: 17,
    fontWeight: "600",
  },
  acceptSellerName: { fontSize: 14 },
  muted: { color: "#999", fontFamily: DOUYIN_SANS, fontSize: 13 },
  chatButton: {
    backgroundColor: "#FF2850",
    borderRadius: 20,
    paddingHorizontal: 18,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  chatText: {
    color: "#FFF",
    fontFamily: DOUYIN_SANS,
    fontSize: 16,
    fontWeight: "600",
  },
  acceptChatButton: { height: 26, borderRadius: 13, paddingHorizontal: 12 },
  acceptChatText: { fontSize: 12 },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 34,
  },
  label: { color: "#999", fontFamily: DOUYIN_SANS, fontSize: 16 },
  acceptLabel: { width: 70, fontSize: 14, lineHeight: 22 },
  infoValue: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    maxWidth: "70%",
  },
  value: {
    color: "#161616",
    fontSize: 12,
    textAlign: "right",
  },
  acceptValue: { flex: 1, fontSize: 14, lineHeight: 22 },
  multilineInfoRow: { alignItems: "flex-start", minHeight: 44 },
  multilineValue: { textAlign: "right" },
  amount: { color: "#F02543", fontWeight: "600" },
  copy: { width: 16, height: 16 },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#EEE",
    marginVertical: 8,
  },
  bottom: {
    backgroundColor: "#FFF",
    paddingHorizontal: 16,
    paddingTop: 16,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    borderTopWidth: 14,
    borderTopColor: "#F7F7F7",
  },
  acceptBottom: { borderTopWidth: 0, paddingTop: 8 },
  bottomAction: { flex: 1, width: undefined },
  outlineButton: {
    width: "100%",
    height: 42,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E7E7E7",
    alignItems: "center",
    justifyContent: "center",
  },
  acceptOutlineButton: { height: 42, borderRadius: 8 },
  acceptPrimaryButton: { borderRadius: 8, overflow: "hidden" },
  outlineText: {
    color: "#111",
    fontFamily: DOUYIN_SANS,
    fontSize: 17,
    fontWeight: "600",
  },
  primaryButton: { paddingHorizontal: 0, borderWidth: 0, backgroundColor: "transparent" },
  primaryGradient: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center" },
  primaryText: { color: "#FFF", fontFamily: DOUYIN_SANS, fontSize: 17, fontWeight: "600" },
  acceptActionText: { fontSize: 14 },
});
