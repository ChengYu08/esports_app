import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { OrderItemModel } from "@/features/order/order.types";
import { DOUYIN_SANS } from "@/shared/theme/typography";
import { BottomSheet } from "@/shared/ui/BottomSheet";
import { CachedImage } from "@/shared/ui/CachedImage";

const closeIcon = require("../../../../assets/mine/payment-close.svg");
const diamondIcon = require("../../../../assets/mine/figma/star-recharge-diamond-3f6fcf.png");
const fallbackAvatar = require("../../../../assets/coms/avatar_default.webp");

type Props = {
  visible: boolean;
  order: OrderItemModel;
  companionName: string;
  companionAvatar?: OrderItemModel["receiverAvatar"];
  serviceTime: string;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function OrderCompleteConfirmSheet({
  visible,
  order,
  companionName,
  companionAvatar,
  serviceTime,
  loading,
  onClose,
  onConfirm,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      dismissOnBackdropPress={!loading}
      backdropStyle={styles.backdrop}
      contentStyle={styles.frame}
    >
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
        <ScrollView
          bounces={false}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          style={styles.scroll}
        >
          <View style={styles.header}>
            <Text accessibilityRole="header" style={styles.title}>确认完成订单</Text>
            <Pressable
              accessibilityLabel="关闭确认完成订单弹窗"
              accessibilityRole="button"
              disabled={loading}
              hitSlop={8}
              onPress={onClose}
              style={styles.closeButton}
            >
              <CachedImage source={closeIcon} style={styles.closeIcon} />
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
        </ScrollView>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: loading }}
          disabled={loading}
          onPress={onConfirm}
          style={[styles.confirmButton, loading && styles.confirmButtonDisabled]}
        >
          <LinearGradient
            colors={["#FF2145", "#FF3158"]}
            end={{ x: 1, y: 1 }}
            start={{ x: 0, y: 0 }}
            style={styles.confirmGradient}
          >
            <Text style={styles.confirmText}>{loading ? "处理中..." : "确认完成"}</Text>
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
  frame: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    maxHeight: "92%",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  content: { paddingBottom: 4 },
  scroll: { flexShrink: 1 },
  header: { minHeight: 32, flexDirection: "row", alignItems: "center" },
  title: { flex: 1, color: "#0A0A0A", fontFamily: DOUYIN_SANS, fontSize: 16, fontWeight: "600" },
  closeButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  closeIcon: { width: 32, height: 32 },
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
  confirmButton: { height: 42, marginTop: 16, overflow: "hidden", borderRadius: 8 },
  confirmButtonDisabled: { opacity: 0.7 },
  confirmGradient: { flex: 1, alignItems: "center", justifyContent: "center" },
  confirmText: { color: "#FFFFFF", fontFamily: DOUYIN_SANS, fontSize: 14, fontWeight: "600" },
});
