import { Copy16Regular } from "@fluentui/react-native-icons";
import * as Clipboard from "expo-clipboard";
import { LinearGradient } from "expo-linear-gradient";
import { memo, useEffect, useState, type ReactNode } from "react";
import type { ImageSource } from "expo-image";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";
import { showToast } from "@/shared/ui/app-toast";

import {
  computeOrderPayableStars,
  formatOrderFreeSummary,
  formatStar,
} from "@/features/order/free-amount";
import { formatOrderTime } from "@/features/order/order-detail-format";
import { formatPaymentCountdown, getPaymentDeadline } from "../payment-countdown";
import { SYSTEM_FONT } from "@/shared/theme/typography";
import { CachedImage } from "@/shared/ui/CachedImage";
import type {
  OrderAction,
  OrderActionKey,
  OrderItemModel,
  OrderStatus,
  OrderScope,
} from "../order.types";

const PRIMARY_GRADIENT = ["#FF1F2E", "#FF1F69"] as const;

const STATUS_COLORS: Record<OrderStatus, string> = {
  pendingPayment: "#FF943D",
  paid: "#14A357",
  waitingService: "#FF943D",
  inService: "#FF943D",
  completed: "#808080",
  partiallyRefunded: "#808080",
  cancelled: "#808080",
  refunded: "#808080",
};

type OrderCardProps = {
  item: OrderItemModel;
  /** 列表未携带 clubName 时由外部按 companionClubId 解析后传入 */
  clubName?: string;
  onAction: (item: OrderItemModel, action: OrderActionKey) => void;
  onPress?: (item: OrderItemModel) => void;
  actionPending?: boolean;
  active?: boolean;
  onPaymentExpired?: () => void;
  scope: OrderScope;
  gameIcon?: ImageSource;
};

export const OrderCard = memo(function OrderCard({
  item,
  onAction,
  onPress,
  actionPending = false,
  active = true,
  onPaymentExpired,
  scope,
  gameIcon,
}: OrderCardProps) {
  const paymentDeadline = getPaymentDeadline(item);
  const freeSummary = formatOrderFreeSummary(item);
  const isActivityOrder = item.orderType === "ACTIVITY";
  const billingUnit = item.billingUnitName ?? "小时";
  const qty = Math.max(1, item.quantity);
  // 活动单三行按单价口径展示；优惠/实付为订单合计时按数量折算
  const activityOriginal = item.unitPrice;
  const activityDiscount = formatStar((item.discountAmount ?? 0) / qty);
  const activityRealPayRaw = Number(item.realPayAmount ?? item.totalPrice);
  const activityRealPay = formatStar(
    (Number.isFinite(activityRealPayRaw) ? activityRealPayRaw : 0) / qty,
  );
  const copyOrderNo = async () => {
    const orderNo = item.orderNo ?? item.id;
    try {
      await Clipboard.setStringAsync(orderNo);
      showToast("订单编号已复制");
    } catch {
      showToast("复制失败，请稍后重试");
    }
  };
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole={onPress ? "button" : undefined}
        onPress={() => onPress?.(item)}
        style={({ pressed }) => [styles.cardContent, pressed && styles.cardPressed]}
      >
        <View style={styles.sellerRow}>
          <View style={styles.seller}>
            <CachedImage
              contentFit="cover"
              source={item.sellerAvatar}
              style={styles.avatar}
            />
            <View style={styles.sellerMeta}>
              <View style={styles.sellerNameRow}>
                <Text numberOfLines={1} style={styles.sellerName}>
                  {item.sellerName}
                </Text>
                {item.voiceTag ? (
                  <Text
                    style={[
                      styles.voiceTag,
                      item.voiceTag === "需试音" && styles.voiceTagRequired,
                    ]}
                  >
                    {item.voiceTag}
                  </Text>
                ) : null}
                {item.activityTag ? (
                  <Text style={styles.activityTag}>{item.activityTag}</Text>
                ) : null}
              </View>
            </View>
          </View>
          <Text
            style={[
              styles.status,
              {
                color: item.sourceLabel
                  ? item.sourceLabel === "客服派单"
                    ? "#1B84E0"
                    : "#FF943D"
                  : STATUS_COLORS[item.status],
              },
            ]}
          >
            {item.sourceLabel ?? item.statusLabel}
          </Text>
        </View>

        <View style={styles.orderBody}>
          <View style={styles.detailPanel}>
            <Text numberOfLines={1} style={styles.serviceName}>
              {item.serviceName}
            </Text>
            <OrderDetailRow label="游戏">
              <View style={styles.gameValue}>
                <CachedImage
                  source={
                    item.gameIcon ??
                    gameIcon ??
                    require("../../../../assets/svgs/game.svg")
                  }
                  contentFit="cover"
                  style={styles.gameIcon}
                />
                <Text numberOfLines={1} style={styles.detailValue}>
                  {item.gameName}
                </Text>
              </View>
            </OrderDetailRow>
            {scope === "dispatch" ? <OrderDetailRow label="时间">
              <Text style={styles.detailValue}>
                {formatOrderTime(item.createTime)}
              </Text>
            </OrderDetailRow> : null}
            {isActivityOrder ? (
              <>
                <OrderDetailRow label="原价" labelWide>
                  <Text style={styles.detailValue}>
                    {`${activityOriginal}钻石/${billingUnit}`}
                  </Text>
                </OrderDetailRow>
                <OrderDetailRow label="优惠减免" labelWide>
                  <Text style={styles.detailValue}>
                    {`${activityDiscount}钻石/${billingUnit}`}
                  </Text>
                </OrderDetailRow>
                <OrderDetailRow label="实付" labelWide>
                  <Text style={styles.detailValue}>
                    {`${activityRealPay}钻石/${billingUnit}`}
                  </Text>
                </OrderDetailRow>
              </>
            ) : (
              <OrderDetailRow label="单价">
                <Text style={styles.detailValue}>
                  {item.unitPrice}钻石/{billingUnit}
                </Text>
              </OrderDetailRow>
            )}
            {scope === "dispatch" ? <OrderDetailRow label="订单号">
              <View style={styles.orderNoValue}>
                <Text numberOfLines={1} style={styles.detailValue}>
                  {item.orderNo ?? item.id}
                </Text>
                <Pressable
                  accessibilityLabel="复制订单号"
                  accessibilityRole="button"
                  hitSlop={6}
                  onPress={copyOrderNo}
                  style={styles.copyButton}
                >
                  <Copy16Regular color="#999999" width={14} height={14} />
                </Pressable>
              </View>
            </OrderDetailRow> : null}
            <OrderDetailRow label="备注">
              <Text numberOfLines={2} style={styles.detailValue}>
                {item.remark || "-"}
              </Text>
            </OrderDetailRow>
            {freeSummary ? (
              <OrderDetailRow label="免单">
                <Text style={[styles.detailValue, styles.freeSummary]}>
                  {freeSummary}
                </Text>
              </OrderDetailRow>
            ) : null}
          </View>
          <View style={styles.totalRow}>
            <View style={styles.quantitySummary}>
              <Text style={styles.quantity}>{item.unitPrice}钻石</Text>
              <Text style={styles.quantity}>x</Text>
              <Text style={styles.totalLabel}>
                {item.quantity}
                {item.billingUnitName ?? "小时"}
              </Text>
            </View>
            <View style={styles.totalValue}>
              <Text style={[styles.totalLabel, styles.totalCaption]}>
                {freeSummary ? "免单后" : "合计"}
              </Text>
              {freeSummary ? (
                <Text style={styles.originalTotal}>{item.totalPrice}</Text>
              ) : null}
              <Text style={styles.totalPrice}>
                {freeSummary
                  ? formatStar(computeOrderPayableStars(item))
                  : item.totalPrice}
              </Text>
              <CachedImage
                source={require("../../../../assets/mine/star-recharge-diamond-3f6fcf.png")}
                contentFit="contain"
                style={styles.diamondIcon}
              />
            </View>
          </View>
        </View>
      </Pressable>

      {item.actions.length > 0 && (
        <View style={styles.actions}>
          {item.actions.map((action) => action.key === "pay" && paymentDeadline !== null ? (
            <PaymentActionButton
              key={`${action.key}:${paymentDeadline}`}
              action={action}
              deadline={paymentDeadline}
              active={active}
              disabled={actionPending}
              onPress={() => onAction(item, action.key)}
              onExpired={onPaymentExpired}
            />
          ) : (
            <ActionButton
              action={action}
              key={action.key}
              disabled={actionPending}
              onPress={() => onAction(item, action.key)}
            />
          ))}
        </View>
      )}
    </View>
  );
});

function OrderDetailRow({
  label,
  children,
  labelWide = false,
}: {
  label: string;
  children: ReactNode;
  labelWide?: boolean;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, labelWide && styles.detailLabelWide]}>
        {label}
      </Text>
      <View style={styles.detailContent}>{children}</View>
    </View>
  );
}

// 每秒仅更新支付按钮，避免触发整个订单列表和卡片重渲染。
function PaymentActionButton({
  action,
  deadline,
  active,
  disabled,
  onPress,
  onExpired,
}: {
  action: OrderAction;
  deadline: number;
  active: boolean;
  disabled: boolean;
  onPress: () => void;
  onExpired?: () => void;
}) {
  const [now, setNow] = useState(Date.now);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!active) {
      return;
    }
    let stopped = false;
    const update = () => {
      if (stopped) {
        return;
      }
      const current = Date.now();
      setNow(current);
      if (current >= deadline) {
        stopped = true;
        setExpired(true);
        clearInterval(timer);
        onExpired?.();
      }
    };
    const timer = setInterval(() => {
      if (AppState.currentState === "active") {
        update();
      }
    }, 1000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        update();
      }
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [active, deadline, onExpired]);

  return (
    <ActionButton
      action={{ ...action, label: `${action.label} ${formatPaymentCountdown(deadline, now)}` }}
      disabled={disabled || expired}
      onPress={onPress}
    />
  );
}

function ActionButton({
  action,
  onPress,
  disabled,
}: {
  action: OrderAction;
  onPress: () => void;
  disabled: boolean;
}) {
  if (action.variant === "primary") {
    return (
      <Pressable
        accessibilityLabel={action.label}
        accessibilityRole="button"
        accessibilityState={{ disabled, busy: disabled }}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => pressed && styles.buttonPressed}
      >
        <LinearGradient
          colors={PRIMARY_GRADIENT}
          end={{ x: 1, y: 1 }}
          start={{ x: 0, y: 0 }}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>
            {disabled ? "处理中…" : action.label}
          </Text>
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityLabel={action.label}
      accessibilityRole="button"
      accessibilityState={{ disabled, busy: disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.secondaryButton,
        pressed && styles.buttonPressed,
      ]}
    >
      <Text style={styles.secondaryButtonText}>{action.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    gap: 8,
  },
  cardContent: { gap: 8 },
  sellerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  seller: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sellerMeta: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  sellerNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  avatar: { width: 24, height: 24, borderRadius: 12 },
  sellerName: {
    flexShrink: 1,
    fontFamily: SYSTEM_FONT,
    color: "#0A0A0A",
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "500",
  },
  clubName: {
    fontFamily: SYSTEM_FONT,
    color: "#999999",
    fontSize: 11,
    lineHeight: 14,
  },
  status: {
    marginLeft: 12,
    fontFamily: SYSTEM_FONT,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "500",
  },
  voiceTag: {
    overflow: "hidden",
    borderRadius: 3,
    backgroundColor: "#F2F2F2",
    paddingHorizontal: 4,
    color: "#808080",
    fontFamily: SYSTEM_FONT,
    fontSize: 11,
    lineHeight: 18,
  },
  voiceTagRequired: { color: "#581CE5", backgroundColor: "#F1EBFF" },
  activityTag: {
    overflow: "hidden",
    borderRadius: 3,
    backgroundColor: "#FFE9EC",
    paddingHorizontal: 4,
    color: "#FE1F4C",
    fontFamily: SYSTEM_FONT,
    fontSize: 11,
    lineHeight: 18,
  },
  orderBody: { gap: 8 },
  serviceName: {
    fontFamily: SYSTEM_FONT,
    color: "#0A0A0A",
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "500",
  },
  detailPanel: {
    backgroundColor: "#F7F7F7",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  detailRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  detailLabel: {
    width: 36,
    color: "#999999",
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    lineHeight: 18,
  },
  detailLabelWide: {
    width: "auto",
    minWidth: 48,
  },
  detailContent: { flex: 1 },
  detailValue: {
    color: "#0A0A0A",
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    lineHeight: 18,
  },
  gameValue: { flexDirection: "row", alignItems: "center", gap: 6 },
  gameIcon: { width: 14, height: 14, borderRadius: 4, backgroundColor: "lightgray", overflow: "hidden" },
  orderNoValue: { flexDirection: "row", alignItems: "center", gap: 4 },
  copyButton: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  quantitySummary: { flexDirection: "row", alignItems: "center", gap: 4 },
  totalValue: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
  },
  originalTotal: {
    fontFamily: SYSTEM_FONT,
    color: "#999999",
    fontSize: 12,
    lineHeight: 18,
    textDecorationLine: "line-through",
  },
  freeSummary: { color: "#FE1F4C" },
  quantity: {
    fontFamily: SYSTEM_FONT,
    color: "#999999",
    fontSize: 12,
    lineHeight: 18,
  },
  totalRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 4,
  },
  totalCaption: { color: "#999999" },
  totalLabel: {
    fontFamily: SYSTEM_FONT,
    color: "#0A0A0A",
    fontSize: 12,
    lineHeight: 18,
  },
  totalPrice: {
    fontFamily: SYSTEM_FONT,
    color: "#FE1F4C",
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "500",
  },
  diamondIcon: { width: 14, height: 14 },
  actions: {
    minHeight: 26,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
  },
  secondaryButton: {
    minHeight: 26,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#CCCCCC",
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    fontFamily: SYSTEM_FONT,
    color: "#0A0A0A",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "500",
  },
  primaryButton: {
    minHeight: 26,
    paddingHorizontal: 12,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    fontFamily: SYSTEM_FONT,
    color: "#FFFFFF",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "500",
  },
  buttonPressed: { opacity: 0.65 },
  cardPressed: { opacity: 0.72 },
});
