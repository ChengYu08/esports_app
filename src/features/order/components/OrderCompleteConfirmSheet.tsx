import {
  ChevronDoubleRight16Regular,
  Dismiss16Regular,
} from "@fluentui/react-native-icons";
import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  computeOrderPayableStars,
  formatStar,
} from "@/features/order/free-amount";
import type { OrderItemModel } from "@/features/order/order.types";
import { SYSTEM_FONT } from "@/shared/theme/typography";
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
  onClose: () => void;
  onConfirm: () => void;
};

/** 完成订单确认抽屉：固定标题与操作区，长内容在中间滚动 */
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
  const { height: windowHeight } = useWindowDimensions();
  const payableStars = computeOrderPayableStars(order);
  const hasFreeAmount = Number(order.freeAmount) > 0;
  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={handleClose}
      dismissOnBackdropPress={!loading}
      backdropStyle={styles.backdrop}
      contentStyle={[styles.frame, { height: windowHeight * 0.68 }]}
    >
      <View style={styles.sheet}>
        <View style={styles.heading}>
          <Text accessibilityRole="header" style={styles.title}>
            确认完成订单
          </Text>
          <Text numberOfLines={1} style={styles.orderNumber}>
            订单编号：{order.orderNo || order.id}
          </Text>
          <Pressable
            accessibilityLabel="关闭确认完成订单弹窗"
            accessibilityRole="button"
            disabled={loading}
            hitSlop={8}
            onPress={handleClose}
            style={styles.closeButton}
          >
            <Dismiss16Regular color="#CCCCCC" width={20} height={20} />
          </Pressable>
        </View>
        <ScrollView
          bounces={false}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          style={styles.scroll}
        >
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
              <ChevronDoubleRight16Regular
                color="#999999"
                width={16}
                height={16}
              />
            </View>
          </View>
          <DetailRow label="游戏">
            <View style={styles.gameValue}>
              {order.gameIcon ? (
                <CachedImage
                  contentFit="cover"
                  source={order.gameIcon}
                  style={styles.gameIcon}
                />
              ) : null}
              <Text style={[styles.value, styles.gameName]}>
                {order.gameName || "未知游戏"}
              </Text>
            </View>
          </DetailRow>
          <DetailRow label="服务">
            <Text style={styles.value}>{order.serviceName || "陪玩服务"}</Text>
          </DetailRow>
          <DetailRow label="数量">
            <Text style={styles.value}>
              {order.quantity}
              {order.billingUnitName || "小时"}
            </Text>
          </DetailRow>
          <DetailRow label="备注">
            <Text style={styles.value}>{order.remark || "-"}</Text>
          </DetailRow>
          <DetailRow label="时间">
            <Text style={styles.value}>
              {serviceTime.replace("T", " ").slice(0, 16)}
            </Text>
          </DetailRow>
          <DetailRow label={hasFreeAmount ? "总价(免单后)" : "总价"}>
            <View style={styles.totalValue}>
              {hasFreeAmount ? (
                <Text style={styles.originalTotal}>{order.totalPrice}</Text>
              ) : null}
              <Text style={styles.total}>{formatStar(payableStars)}</Text>
              <CachedImage source={diamondIcon} style={styles.diamondIcon} />
            </View>
          </DetailRow>
        </ScrollView>
        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: loading }}
            disabled={loading}
            onPress={onConfirm}
            style={[
              styles.confirmButton,
              loading && styles.confirmButtonDisabled,
            ]}
          >
            <LinearGradient
              colors={["#FF1F2E", "#FF1F69"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0.21 }}
              style={styles.confirmGradient}
            >
              <Text style={styles.confirmText}>
                {loading ? "处理中..." : "确认完成"}
              </Text>
            </LinearGradient>
          </Pressable>
        </View>
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
      <Text numberOfLines={1} style={styles.participantName}>
        {name}
      </Text>
    </View>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.detailRow}>
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
  sheet: { flex: 1, backgroundColor: "#FFF" },
  heading: {
    flexShrink: 0,
    gap: 8,
    paddingTop: 16,
    paddingBottom: 8,
    paddingLeft: 16,
    paddingRight: 56,
  },
  title: {
    color: "#0A0A0A",
    fontFamily: SYSTEM_FONT,
    fontSize: 16,
    fontWeight: "500",
    lineHeight: 24,
  },
  orderNumber: {
    color: "#808080",
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    lineHeight: 18,
  },
  closeButton: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 12 },
  participants: { flexDirection: "row", gap: 8, marginBottom: 8 },
  participant: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: "center",
    gap: 8,
    borderRadius: 8,
    backgroundColor: "#F7F7F7",
  },
  participantLabel: {
    color: "#666666",
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    lineHeight: 18,
  },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  participantName: {
    maxWidth: "100%",
    color: "#0A0A0A",
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 18,
  },
  participantArrow: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: 24,
    height: 24,
    marginLeft: -12,
    marginTop: -12,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EBEBEB",
    backgroundColor: "#FFF",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 8,
    gap: 12,
  },
  label: {
    width: 96,
    flexShrink: 1,
    color: "#666666",
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    lineHeight: 22,
  },
  detailValue: { flex: 1, minWidth: 0, alignItems: "flex-end" },
  value: {
    color: "#0A0A0A",
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    lineHeight: 22,
    textAlign: "right",
  },
  gameValue: {
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  gameName: { flexShrink: 1 },
  gameIcon: { width: 20, height: 20, borderRadius: 4 },
  totalValue: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 4,
  },
  originalTotal: {
    color: "#979799",
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    lineHeight: 22,
    textDecorationLine: "line-through",
  },
  total: {
    color: "#FE1F4C",
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 22,
  },
  diamondIcon: { width: 16, height: 14 },
  footer: { flexShrink: 0, paddingTop: 8, paddingHorizontal: 16 },
  confirmButton: { height: 42, overflow: "hidden", borderRadius: 8 },
  confirmButtonDisabled: { opacity: 0.7 },
  confirmGradient: { flex: 1, alignItems: "center", justifyContent: "center" },
  confirmText: {
    color: "#FFF",
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 22,
  },
});
