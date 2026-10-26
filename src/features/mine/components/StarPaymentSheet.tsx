import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MatchLinearGradient } from "@/features/match/components/MatchLinearGradient";
import {
  fetchStarBalance,
  payCompanionOrder,
} from "@/features/mine/api/companion-order.api";
import { DOUYIN_SANS } from "@/shared/theme/typography";
import { AppPrompt } from "@/shared/ui/AppPrompt";
import { BottomSheet } from "@/shared/ui/BottomSheet";

const starDiamondIcon = require("../../../../assets/mine/figma/star-recharge-diamond-3f6fcf.png");
const paymentCloseIcon = require("../../../../assets/mine/payment-close.svg");
const CONFIRM_GRADIENT = ["#FF1F2E", "#FF1F69"] as const;

type StarPaymentSheetProps = {
  order: { orderId: number; total: number };
  visible: boolean;
  token: string | null;
  onClose: () => void | Promise<void>;
  onPaid: () => void;
  onPaymentFailed: (message: string) => void;
};

export function StarPaymentSheet({
  order,
  visible,
  token,
  onClose,
  onPaid,
  onPaymentFailed,
}: StarPaymentSheetProps) {
  const insets = useSafeAreaInsets();
  const [balance, setBalance] = useState<number | null>(null);
  const [paying, setPaying] = useState(false);
  const settledRef = useRef(false);
  const [prompt, setPrompt] = useState<{
    title?: string;
    message: string;
  } | null>(null);
  const payDisabled = paying || balance === null;

  useEffect(() => {
    if (!visible || !token) return;
    setBalance(null);
    void fetchStarBalance(token)
      .then(setBalance)
      .catch((error: Error) => setPrompt({ message: error.message }));
  }, [token, visible]);

  async function pay() {
    if (!token) return setPrompt({ message: "请先登录" });
    if ((balance ?? 0) < order.total)
      return setPrompt({
        title: "余额不足",
        message: "当前星钻余额不足，请充值后再支付",
      });
    setPaying(true);
    try {
      await payCompanionOrder(order.orderId, token);
      settledRef.current = true;
      onPaid();
    } catch (error) {
      onPaymentFailed(error instanceof Error ? error.message : "支付失败");
      if (!settledRef.current) {
        settledRef.current = true;
        await onClose();
      }
    } finally {
      setPaying(false);
    }
  }

  return (
    <>
      <BottomSheet
        visible={visible}
        onClose={() => void onClose()}
        dismissOnBackdropPress={!paying}
        scrollable
        contentStyle={[
          styles.paymentModal,
          { paddingBottom: Math.max(insets.bottom, 12) + 12 },
        ]}
      >
        <View style={styles.paymentModalHeader}>
          <View style={styles.paymentModalHeading}>
            <Text style={styles.paymentModalTitle}>星钻支付</Text>
            <Text style={styles.paymentModalHint}>
              请在5分钟内支付，否则订单自动取消
            </Text>
          </View>
          <Pressable
            accessibilityLabel="关闭星钻支付"
            disabled={paying}
            hitSlop={8}
            onPress={() => void onClose()}
            style={styles.paymentClose}
          >
            <Image source={paymentCloseIcon} style={styles.paymentCloseIcon} />
          </Pressable>
        </View>
        <View style={styles.paymentRows}>
          <View style={styles.paymentRow}>
            <Text style={styles.paymentRowLabel}>订单金额</Text>
            <View style={styles.paymentRowValue}>
              <Text style={styles.paymentTotalValue}>{order.total}</Text>
              <Image source={starDiamondIcon} style={styles.paymentDiamond} />
            </View>
          </View>
          <View style={styles.paymentRow}>
            <Text style={styles.paymentRowLabel}>我的余额</Text>
            <View style={styles.paymentRowValue}>
              <Text style={styles.paymentBalanceValue}>
                {balance === null ? "..." : balance}
              </Text>
              <Image source={starDiamondIcon} style={styles.paymentDiamond} />
            </View>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="确认支付"
          accessibilityState={{ disabled: payDisabled }}
          disabled={payDisabled}
          onPress={() => void pay()}
          style={({ pressed }) => [
            styles.paySubmitWrap,
            pressed && !payDisabled && styles.payPressed,
            payDisabled && styles.paySubmitDisabled,
          ]}
        >
          <MatchLinearGradient
            colors={CONFIRM_GRADIENT}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.paySubmit}
          >
            <Text style={styles.paySubmitText}>
              {paying ? "支付中..." : "确认支付"}
            </Text>
          </MatchLinearGradient>
        </Pressable>
      </BottomSheet>
      <AppPrompt
        visible={Boolean(prompt)}
        title={prompt?.title}
        message={prompt?.message ?? ""}
        confirmText={prompt?.title === "余额不足" ? "去充值" : "知道了"}
        cancelText={prompt?.title === "余额不足" ? "取消" : undefined}
        onCancel={
          prompt?.title === "余额不足" ? () => setPrompt(null) : undefined
        }
        onConfirm={() => {
          const goRecharge = prompt?.title === "余额不足";
          setPrompt(null);
          if (goRecharge) router.push("/star-recharge");
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  paymentModal: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    overflow: "hidden",
  },
  paymentModalHeader: {
    minHeight: 56,
    paddingLeft: 16,
    paddingTop: 16,
    paddingBottom: 8,
    paddingRight: 48,
    justifyContent: "center",
  },
  paymentModalHeading: { gap: 8 },
  paymentModalTitle: {
    color: "#0A0A0A",
    fontFamily: DOUYIN_SANS,
    fontSize: 16,
    fontWeight: "500",
    lineHeight: 24,
  },
  paymentModalHint: {
    color: "#808080",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    lineHeight: 18,
  },
  paymentClose: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  paymentCloseIcon: { width: 24, height: 24 },
  paymentRows: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  paymentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  paymentRowLabel: {
    width: 96,
    color: "#666666",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    lineHeight: 22,
  },
  paymentRowValue: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  paymentTotalValue: {
    color: "#0A0A0A",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 22,
    textAlign: "right",
  },
  paymentBalanceValue: {
    color: "#FE1F4C",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 22,
    textAlign: "right",
  },
  paymentDiamond: {
    width: 16,
    height: 16,
  },
  paySubmitWrap: {
    marginHorizontal: 16,
    marginTop: 8,
  },
  paySubmit: {
    height: 42,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  paySubmitDisabled: {
    opacity: 0.6,
  },
  payPressed: {
    opacity: 0.9,
  },
  paySubmitText: {
    color: "#FFFFFF",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 22,
  },
});
