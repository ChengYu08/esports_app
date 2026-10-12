import { useAuthStore } from "@esports/auth";
import { useQuery } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Toast from "react-native-root-toast";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { queryClient } from "@/core/query/query-client";
import { OrderAfterSaleSheet } from "@/features/order/components/OrderAfterSaleSheet";
import { OrderReviewSheet } from "@/features/order/components/OrderReviewSheet";
import { getOrderDetailAction } from "@/features/order/order-detail-actions";
import { buildAfterSalePayload } from "@/features/order/after-sale-card";
import {
  cancelOrder,
  completeOrder,
  fetchAfterSaleMembers,
  fetchOrderDetail,
  fetchOrderReview,
  mapOrder,
  submitOrderReview,
  type AfterSaleMember,
  type OrderReview,
} from "@/features/order/order.api";
import type { OrderItemModel } from "@/features/order/order.types";
import { requireLogin } from "@/shared/navigation/require-login";
import { DOUYIN_SANS } from "@/shared/theme/typography";
import { AppPrompt } from "@/shared/ui/AppPrompt";
import { CachedImage } from "@/shared/ui/CachedImage";

const copyIcon = require("../../../assets/coms/copy.svg");

export default function OrderDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const token = useAuthStore((state) => state.accessToken);
  const [cancelPromptVisible, setCancelPromptVisible] = useState(false);
  const [completePromptVisible, setCompletePromptVisible] = useState(false);
  const [afterSaleVisible, setAfterSaleVisible] = useState(false);
  const [afterSaleMembers, setAfterSaleMembers] = useState<AfterSaleMember[]>(
    [],
  );
  const [afterSaleLoading, setAfterSaleLoading] = useState(false);
  const [reviewVisible, setReviewVisible] = useState(false);
  const [reviewDetail, setReviewDetail] = useState<OrderReview | null>(null);
  const [prompt, setPrompt] = useState<{
    title: string;
    message: string;
  } | null>(null);
  const detail = useQuery({
    queryKey: ["order-detail", id],
    queryFn: async () => mapOrder(await fetchOrderDetail(id, token as string)),
    enabled: Boolean(id && token),
  });
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
    order.status === "completed"
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
  const orderNumber = order.orderNo ?? order.id;
  const handleChat = () => {
    if (!requireLogin()) return;
    if (!order.receiverUserId || order.receiverUserId === "0") {
      setPrompt({
        title: "暂时无法聊天",
        message: "订单暂无接单者信息，请稍后重试",
      });
      return;
    }
    router.push({
      pathname: "/chat/[id]",
      params: {
        id: order.receiverUserId,
        title: order.sellerName,
        avatar:
          typeof order.sellerAvatar === "string" ? order.sellerAvatar : "",
        clubId: order.clubId ? String(order.clubId) : "",
      },
    });
  };
  const statusHint = isPending
    ? "请在剩余时间内完成支付"
    : isCompleted
      ? "感谢你的支持"
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

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Pressable
          accessibilityLabel="返回"
          hitSlop={12}
          onPress={() => router.back()}
          style={styles.back}
        >
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={styles.headerTitle} />
        <View style={styles.headerSlot} />
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: (detailAction ? 148 : 24) + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.statusBlock, { height: 84, paddingTop: 12 }]}>
          <Text style={styles.statusTitle}>
            {isPending
              ? "待支付"
              : order.statusLabel === "已支付"
                ? "进行中"
                : order.statusLabel}
          </Text>
          <Text style={[styles.statusHint, { marginTop: 8, lineHeight: 22 }]}>
            {statusHint}
          </Text>
        </View>
        {!isCancelled && <ProgressSteps status={order.status} />}
        <View style={styles.infoBlock}>
          <View style={styles.sellerRow}>
            <CachedImage
              contentFit="cover"
              source={order.sellerAvatar}
              style={styles.avatar}
            />
            <View style={styles.sellerCopy}>
              <Text style={styles.sellerName}>{order.sellerName}</Text>
              <Text style={styles.muted}>盼之电竞自营俱乐部</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={handleChat}
              style={styles.chatButton}
            >
              <Text style={styles.chatText}>聊一聊</Text>
            </Pressable>
          </View>
          <View style={styles.divider} />
          <InfoRow label="游戏" value={order.gameName} />
          <InfoRow label="服务" value={order.serviceName.replace("服务", "")} />
          <InfoRow label="备注" value="-" />
          <InfoRow label="单价" value={`${order.unitPrice}星钻/小时`} />
          <InfoRow label="个数" value={`x ${order.quantity}`} />
          <InfoRow label="实付款" value={`${order.totalPrice}星钻`} />
        </View>
        <View style={styles.infoBlock}>
          <InfoRow
            label="订单编号"
            value={orderNumber}
            copy
            onCopy={() => void copyOrderNumber()}
          />
          <InfoRow label="创建时间" value={formatOrderTime(order.createTime)} />
          <InfoRow label="支付时间" value={formatOrderTime(order.paidTime)} />
          <InfoRow
            label="接单时间"
            value={formatOrderTime(order.acceptedTime)}
          />
          <InfoRow
            label="服务时间"
            value={formatServiceTime(
              order.serviceStartTime,
              order.serviceEndTime,
            )}
          />
          <InfoRow
            label="完成时间"
            value={formatOrderTime(order.completedTime)}
          />
        </View>
      </ScrollView>
      {detailActions.length ? (
        <View
          style={[
            styles.bottom,
            { paddingBottom: Math.max(insets.bottom, 12) },
          ]}
        >
          {detailActions.map((action) => (
            <Pressable
              key={action.key}
              onPress={() => {
                if (action.key === "cancel") {
                  setCancelPromptVisible(true);
                } else if (action.key === "complete") {
                  setCompletePromptVisible(true);
                } else if (action.key === "afterSales") {
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
                  } else {
                    setAfterSaleMembers([]);
                  }
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
              }}
              style={styles.outlineButton}
            >
              <Text style={styles.outlineText}>{action.label}</Text>
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
              await queryClient.invalidateQueries({ queryKey: ["orders"] });
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
          setReviewVisible(false);
          await detail.refetch();
        }}
      />
      <AppPrompt
        visible={completePromptVisible}
        title="提示"
        message={`确定完成订单吗，订单号：${order.orderNo ?? order.id}`}
        cancelText="取消"
        confirmText="确认"
        onCancel={() => setCompletePromptVisible(false)}
        onConfirm={() => {
          setCompletePromptVisible(false);
          if (!token) return;
          void completeOrder(order.id, token)
            .then(async () => {
              await queryClient.invalidateQueries({ queryKey: ["orders"] });
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
      <AppPrompt
        visible={Boolean(prompt)}
        title={prompt?.title}
        message={prompt?.message ?? ""}
        onConfirm={() => setPrompt(null)}
      />
    </View>
  );
}

function ProgressSteps({ status }: { status: OrderItemModel["status"] }) {
  const labels = ["支付订单", "陪玩确认", "陪玩服务", "服务完成"];
  const activeStep =
    status === "pendingPayment"
      ? 0
      : status === "paid"
        ? 1
        : status === "waitingService" || status === "inService"
          ? 2
          : 4;
  return (
    <View style={styles.flow}>
      <View style={styles.flowLine} />
      {labels.map((label, index) => {
        const done = index < activeStep;
        const active = index === activeStep;
        return (
          <View style={styles.flowStep} key={label}>
            <View
              style={[
                styles.flowMarker,
                done && styles.flowMarkerDone,
                active && styles.flowMarkerActive,
              ]}
            >
              {done ? (
                <Text style={styles.flowCheck}>✓</Text>
              ) : active ? (
                <View style={styles.flowActiveDot} />
              ) : (
                <Text style={styles.flowNumber}>{index + 1}</Text>
              )}
            </View>
            <Text
              style={[
                styles.flowLabel,
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
}: {
  label: string;
  value: string;
  copy?: boolean;
  onCopy?: () => void;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.infoValue}>
        <Text style={[styles.value, label === "实付款" && styles.amount]}>
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

const styles = StyleSheet.create({
  flow: {
    height: 74,
    flexDirection: "row",
    position: "relative",
    alignItems: "flex-start",
  },
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
  backText: { color: "#111", fontSize: 34, lineHeight: 28, fontWeight: "300" },
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
  sellerRow: { flexDirection: "row", alignItems: "center", minHeight: 58 },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 10 },
  sellerCopy: { flex: 1, gap: 4 },
  sellerName: {
    color: "#111",
    fontFamily: DOUYIN_SANS,
    fontSize: 17,
    fontWeight: "600",
  },
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
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 34,
  },
  label: { color: "#999", fontFamily: DOUYIN_SANS, fontSize: 16 },
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
    borderTopWidth: 14,
    borderTopColor: "#F7F7F7",
  },
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
  outlineText: {
    color: "#111",
    fontFamily: DOUYIN_SANS,
    fontSize: 17,
    fontWeight: "600",
  },
});
