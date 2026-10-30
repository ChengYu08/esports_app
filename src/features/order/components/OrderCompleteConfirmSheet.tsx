import { Dismiss16Regular } from "@fluentui/react-native-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useMemo, useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  computeFreeStarAmount,
  computeFreeUnitPrice,
  formatHours,
  formatStar,
  FREE_STEP,
  parseHoursLive,
  roundStar,
  sanitizeHoursText,
} from "@/features/order/free-amount";
import type { OrderItemModel } from "@/features/order/order.types";
import { DOUYIN_SANS } from "@/shared/theme/typography";
import { BottomSheet } from "@/shared/ui/BottomSheet";
import { CachedImage } from "@/shared/ui/CachedImage";

const diamondIcon = require("../../../../assets/mine/figma/star-recharge-diamond-3f6fcf.png");
const fallbackAvatar = require("../../../../assets/coms/avatar_default.webp");

type Props = {
  visible: boolean;
  order: OrderItemModel;
  companionName: string;
  companionAvatar?: OrderItemModel["receiverAvatar"];
  serviceTime: string;
  loading: boolean;
  /** complete：完成订单；free：免单（同壳 + 免单时长步进器） */
  mode?: "complete" | "free";
  onClose: () => void;
  /** free 模式携带免单时长 */
  onConfirm: (freeHours?: number) => void;
};

export function OrderCompleteConfirmSheet({
  visible,
  order,
  companionName,
  companionAvatar,
  serviceTime,
  loading,
  mode = "complete",
  onClose,
  onConfirm,
}: Props) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const isFree = mode === "free";
  const [hoursText, setHoursText] = useState("");
  const freeHours = parseHoursLive(hoursText);
  const orderTotalStars = Number(order.totalPrice) || 0;
  const freeStarAmount = isFree ? computeFreeStarAmount(order, freeHours ?? 0) : null;
  const freeValid =
    freeStarAmount != null && freeStarAmount > 0 && freeStarAmount <= orderTotalStars;

  /** 免单时长上限：不超过订单时长，且金额不超过订单总价 */
  const maxFreeHours = useMemo(() => {
    const price = computeFreeUnitPrice(order);
    const orderHours = Math.max(FREE_STEP, Number(order.quantity) || 1);
    let cap = orderHours;
    if (price > 0) {
      const byAmount = Math.floor((orderTotalStars / price) * 10) / 10;
      if (Number.isFinite(byAmount) && byAmount > 0) {
        cap = Math.min(cap, byAmount);
      }
      while (roundStar(cap * price) > orderTotalStars && cap > FREE_STEP) {
        cap = Number((cap - FREE_STEP).toFixed(1));
      }
    }
    return cap;
  }, [order, orderTotalStars]);

  const canDecFreeHours =
    freeHours != null && Number((freeHours - FREE_STEP).toFixed(1)) > 0;
  const canIncFreeHours = (() => {
    const next = Number(((freeHours ?? 0) + FREE_STEP).toFixed(1));
    if (next > maxFreeHours) {
      return false;
    }
    const stars = computeFreeStarAmount(order, next);
    return stars != null && stars <= orderTotalStars;
  })();

  const handleHoursChange = (raw: string) => {
    const safe = sanitizeHoursText(raw);
    const parsed = parseHoursLive(safe);
    // 超限时自动回退到最大允许值，避免提交时被静默禁用
    if (parsed != null && parsed > maxFreeHours) {
      setHoursText(formatHours(maxFreeHours));
      return;
    }
    setHoursText(safe);
  };

  const decFreeHours = () => {
    if (loading || freeHours == null) {
      return;
    }
    const next = Number((freeHours - FREE_STEP).toFixed(1));
    if (next <= 0) {
      return;
    }
    setHoursText(formatHours(next));
  };

  const incFreeHours = () => {
    if (loading || !canIncFreeHours) {
      return;
    }
    const next = Number(((freeHours ?? 0) + FREE_STEP).toFixed(1));
    setHoursText(formatHours(next));
  };

  const handleConfirm = () => {
    if (isFree) {
      if (!freeValid || freeHours == null) {
        return;
      }
      onConfirm(freeHours);
      return;
    }
    onConfirm();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      dismissOnBackdropPress={!loading}
      backdropStyle={styles.backdrop}
      contentStyle={[styles.frame, { height: windowHeight * 0.65 }]}
    >
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
        <ScrollView
          bounces={false}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          style={styles.scroll}
        >
          <View style={styles.header}>
            <Text accessibilityRole="header" style={styles.title}>{isFree ? "免单" : "确认完成订单"}</Text>
            <Pressable
              accessibilityLabel="关闭确认完成订单弹窗"
              accessibilityRole="button"
              disabled={loading}
              hitSlop={8}
              onPress={onClose}
              style={styles.closeButton}
            >
              <View style={styles.closeIcon}>
                <Dismiss16Regular color="#CCCCCC" width={20} height={20} />
              </View>
            </Pressable>
          </View>
          <Text style={styles.orderNumber}>订单编号：{order.orderNo || order.id}</Text>

          <View style={styles.participants}>
            <Participant
              label="点单玩家"
              name={order.sellerName || "老板"}
              avatar={order.sellerAvatar}
            />
            <Participant
              label="接单陪玩"
              name={companionName}
              avatar={companionAvatar ?? fallbackAvatar}
            />
            <View pointerEvents="none" style={styles.participantArrow}>
              <Text style={styles.participantArrowText}>››</Text>
            </View>
          </View>

          <DetailRow label="游戏">
            <View style={styles.gameValue}>
              {order.gameIcon ? (
                <CachedImage contentFit="cover" source={order.gameIcon} style={styles.gameIcon} />
              ) : null}
              <Text numberOfLines={1} style={styles.value}>{order.gameName || "未知游戏"}</Text>
            </View>
          </DetailRow>
          <DetailRow label="服务">
            <Text numberOfLines={2} style={styles.value}>{order.serviceName.replace("服务", "") || "陪玩服务"}</Text>
          </DetailRow>
          <DetailRow label="数量">
            <Text style={styles.value}>{order.quantity}{order.billingUnitName || "小时"}</Text>
          </DetailRow>
          <DetailRow label="备注" multiline>
            <Text style={styles.value}>{order.remark || "-"}</Text>
          </DetailRow>
          <DetailRow label="时间">
            <Text style={styles.value}>{serviceTime}</Text>
          </DetailRow>
          <DetailRow label="总价">
            <View style={styles.totalValue}>
              <Text style={styles.total}>{order.totalPrice}</Text>
              <CachedImage source={diamondIcon} style={styles.diamondIcon} />
            </View>
          </DetailRow>
          {isFree ? (
            <View style={styles.freeRow}>
              <Text style={styles.freeLabel}>免单</Text>
              <View style={styles.qtyBox}>
                <Pressable
                  accessibilityLabel="减少免单时长"
                  accessibilityRole="button"
                  disabled={loading || !canDecFreeHours}
                  hitSlop={4}
                  onPress={decFreeHours}
                  style={[
                    styles.qtyBtn,
                    (loading || !canDecFreeHours) && styles.qtyBtnDisabled,
                  ]}
                >
                  <Text style={styles.qtyBtnText}>−</Text>
                </Pressable>
                <View style={styles.qtyInputBox}>
                  <TextInput
                    accessibilityLabel="免单时长"
                    editable={!loading}
                    keyboardType="decimal-pad"
                    maxLength={8}
                    onChangeText={handleHoursChange}
                    style={styles.qtyInput}
                    value={hoursText}
                  />
                  <Text style={styles.qtyUnit}>{order.billingUnitName || "小时"}</Text>
                </View>
                <Pressable
                  accessibilityLabel="增加免单时长"
                  accessibilityRole="button"
                  disabled={loading || !canIncFreeHours}
                  hitSlop={4}
                  onPress={incFreeHours}
                  style={[
                    styles.qtyBtn,
                    (loading || !canIncFreeHours) && styles.qtyBtnDisabled,
                  ]}
                >
                  <Text style={styles.qtyBtnText}>+</Text>
                </Pressable>
              </View>
              {freeStarAmount != null ? (
                <View style={styles.freeStars}>
                  <Text style={styles.freeStarsText}>{formatStar(freeStarAmount)}</Text>
                  <CachedImage source={diamondIcon} style={styles.diamondIcon} />
                </View>
              ) : null}
            </View>
          ) : null}
        </ScrollView>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: loading || (isFree && !freeValid) }}
          disabled={loading || (isFree && !freeValid)}
          onPress={handleConfirm}
          style={[
            styles.confirmButton,
            (loading || (isFree && !freeValid)) && styles.confirmButtonDisabled,
          ]}
        >
          <LinearGradient
            colors={["#FF2145", "#FF3158"]}
            end={{ x: 1, y: 1 }}
            start={{ x: 0, y: 0 }}
            style={styles.confirmGradient}
          >
            <Text style={styles.confirmText}>
              {loading ? "处理中..." : isFree ? "确认免单" : "确认完成"}
            </Text>
          </LinearGradient>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

function Participant({
  label,
  name,
  avatar,
}: {
  label: string;
  name: string;
  avatar: OrderItemModel["sellerAvatar"];
}) {
  return (
    <View style={styles.participant}>
      <Text style={styles.participantLabel}>{label}</Text>
      <CachedImage contentFit="cover" source={avatar} style={styles.avatar} />
      <Text numberOfLines={1} style={styles.participantName}>{name}</Text>
    </View>
  );
}

function DetailRow({
  label,
  children,
  multiline = false,
}: {
  label: string;
  children: ReactNode;
  multiline?: boolean;
}) {
  return (
    <View style={[styles.detailRow, multiline && styles.multilineRow]}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.detailValue}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: "rgba(0, 0, 0, 0.7)" },
  frame: {
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    overflow: "hidden",
  },
  sheet: {
    // 抽屉外层限制高度，内容滚动，确认按钮固定在底部
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  content: { paddingBottom: 4 },
  scroll: { flex: 1 },
  header: { minHeight: 32, flexDirection: "row", alignItems: "center" },
  title: { flex: 1, color: "#0A0A0A", fontFamily: DOUYIN_SANS, fontSize: 16, fontWeight: "600" },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  closeIcon: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  orderNumber: { marginTop: 2, color: "#999999", fontFamily: DOUYIN_SANS, fontSize: 12, lineHeight: 18 },
  participants: { flexDirection: "row", gap: 8, marginTop: 8, marginBottom: 12 },
  participant: {
    flex: 1,
    minWidth: 0,
    height: 116,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 8,
    backgroundColor: "#F7F7F7",
  },
  participantLabel: { color: "#808080", fontFamily: DOUYIN_SANS, fontSize: 12, lineHeight: 18 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  participantName: { maxWidth: "88%", color: "#0A0A0A", fontFamily: DOUYIN_SANS, fontSize: 14, fontWeight: "500", lineHeight: 20 },
  participantArrow: {
    position: "absolute",
    zIndex: 1,
    left: "50%",
    top: "50%",
    width: 24,
    height: 24,
    marginLeft: -12,
    marginTop: -12,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
  },
  participantArrowText: { marginTop: -2, color: "#999999", fontSize: 17, lineHeight: 20 },
  detailRow: { minHeight: 36, flexDirection: "row", alignItems: "center" },
  multilineRow: { alignItems: "flex-start", paddingVertical: 7 },
  label: { width: 40, color: "#999999", fontFamily: DOUYIN_SANS, fontSize: 14, lineHeight: 22 },
  detailValue: { flex: 1, alignItems: "flex-end" },
  gameValue: { maxWidth: "100%", flexDirection: "row", alignItems: "center", gap: 6 },
  gameIcon: { width: 18, height: 18, borderRadius: 4 },
  value: { maxWidth: "100%", color: "#0A0A0A", fontFamily: DOUYIN_SANS, fontSize: 14, lineHeight: 22, textAlign: "right" },
  totalValue: { flexDirection: "row", alignItems: "center", gap: 4 },
  total: { color: "#FE1F4C", fontFamily: DOUYIN_SANS, fontSize: 14, fontWeight: "500", lineHeight: 22 },
  diamondIcon: { width: 14, height: 11 },
  freeRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10, minHeight: 40 },
  freeLabel: { width: 40, color: "#0A0A0A", fontFamily: DOUYIN_SANS, fontSize: 14, fontWeight: "500", lineHeight: 22 },
  qtyBox: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 4 },
  qtyBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "#F7F7F7",
  },
  qtyBtnDisabled: { backgroundColor: "transparent", borderWidth: 1, borderColor: "#F0F0F0" },
  qtyBtnText: { color: "#0A0A0A", fontSize: 17, lineHeight: 20 },
  qtyInputBox: {
    flex: 1,
    minWidth: 0,
    height: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#F7F7F7",
  },
  qtyInput: {
    flex: 1,
    minWidth: 0,
    padding: 0,
    color: "#0A0A0A",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    lineHeight: 20,
  },
  qtyUnit: { color: "#0A0A0A", fontFamily: DOUYIN_SANS, fontSize: 14 },
  freeStars: { flexDirection: "row", alignItems: "center", gap: 4 },
  freeStarsText: { color: "#FE1F4C", fontFamily: DOUYIN_SANS, fontSize: 16, fontWeight: "500" },
  confirmButton: { height: 42, flexShrink: 0, marginTop: 16, overflow: "hidden", borderRadius: 8 },
  confirmButtonDisabled: { opacity: 0.7 },
  confirmGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmText: { color: "#FFFFFF", fontFamily: DOUYIN_SANS, fontSize: 14, fontWeight: "600" },
});
