import { Dismiss16Regular } from "@fluentui/react-native-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MatchLinearGradient } from "@/features/match/components/MatchLinearGradient";
import { StarNotEnoughError } from "@/features/match/api/match.api";
import { payCompanionOrder } from "@/features/mine/api/companion-order.api";
import { useStarBalance } from "@/features/mine/hooks/use-star-balance";
import { AppPrompt } from "@/shared/ui/AppPrompt";
import { BottomSheet } from "@/shared/ui/BottomSheet";

const starDiamondIcon = require("../../../../assets/mine/star-recharge-diamond-3f6fcf.png");
const CONFIRM_GRADIENT = ["#FF1F2E", "#FF1F69"] as const;

type StarPaymentSheetProps = {
  order: { orderId: number; total: number };
  visible: boolean;
  token: string | null;
  onClose: () => void | Promise<void>;
  onPaid: () => void;
  /** 点「去充值」导航前的钩子（如语聊房宿主标记跳过成员弹窗恢复） */
  onGoRecharge?: () => void;
};

export function StarPaymentSheet({
  order,
  visible,
  token,
  onClose,
  onPaid,
  onGoRecharge,
}: StarPaymentSheetProps) {
  const insets = useSafeAreaInsets();
  const [paying, setPaying] = useState(false);
  const payingRef = useRef(false);
  const [balanceAttempt, setBalanceAttempt] = useState(0);
  const [balanceFailed, setBalanceFailed] = useState(false);
  // iOS 同链只能呈现一个原生 Modal：余额不足等提示经 BottomSheet 的 overlay 插槽
  // 渲染在支付弹窗自己的 Modal 窗口内，不能作为第二个原生 Modal 叠加
  const [prompt, setPrompt] = useState<{
    title?: string;
    message: string;
  } | null>(null);
  const balance = useStarBalance(token, visible, {
    refreshKey: balanceAttempt,
    onError: (error) => {
      setBalanceFailed(true);
      setPrompt({ title: "余额加载失败", message: error.message });
    },
  });
  const payDisabled = paying || balance === null;

  async function confirmPrompt() {
    const goRecharge = prompt?.title === "余额不足";
    const retryBalance = prompt?.title === "余额加载失败";
    setPrompt(null);
    if (retryBalance) {
      setBalanceFailed(false);
      setBalanceAttempt((value) => value + 1);
      return;
    }
    if (!goRecharge) {
      return;
    }
    onGoRecharge?.();
    // 去充值前先关掉支付弹窗，否则原生 Modal 会盖住跳转后的充值页
    await onClose();
    router.push("/star-recharge");
  }

  async function pay() {
    if (payingRef.current) {
      return;
    }
    if (!token) return setPrompt({ message: "请先登录" });
    if ((balance ?? 0) < order.total)
      return setPrompt({
        title: "余额不足",
        message: "当前钻石余额不足，请充值后再支付",
      });
    payingRef.current = true;
    setPaying(true);
    try {
      await payCompanionOrder(order.orderId, token);
      onPaid();
    } catch (error) {
      if (error instanceof StarNotEnoughError) {
        // 服务端判定余额不足（本地余额过期）：弹内嵌余额不足提示，保留弹窗可充值后重试
        setPrompt({
          title: "余额不足",
          message: "当前钻石余额不足，请充值后再支付",
        });
        return;
      }
      setPrompt({ title: "支付失败", message: error instanceof Error ? error.message : "支付失败" });
    } finally {
      payingRef.current = false;
      setPaying(false);
    }
  }

  return (
    <>
      <BottomSheet
        visible={visible}
        onClose={() => {
          if (prompt) {
            setPrompt(null);
          } else if (!payingRef.current) {
            onClose();
          }
        }}
        dismissOnBackdropPress={!paying}
        scrollable
        contentStyle={[
          styles.paymentModal,
          { paddingBottom: Math.max(insets.bottom, 12) + 12 },
        ]}
        overlay={
          <AppPrompt
            inline
            visible={Boolean(prompt)}
            title={prompt?.title}
            message={prompt?.message ?? ""}
            confirmText={prompt?.title === "余额不足" ? "去充值" : prompt?.title === "余额加载失败" ? "重试" : "知道了"}
            cancelText={prompt?.title === "余额不足" || prompt?.title === "余额加载失败" ? "取消" : undefined}
            onCancel={
              prompt?.title === "余额不足" || prompt?.title === "余额加载失败" ? () => setPrompt(null) : undefined
            }
            onConfirm={() => void confirmPrompt()}
          />
        }
      >
        <View style={styles.paymentModalHeader}>
          <View style={styles.paymentModalHeading}>
            <Text style={styles.paymentModalTitle}>钻石支付</Text>
            <Text style={styles.paymentModalHint}>
              请在5分钟内支付，否则订单自动取消
            </Text>
          </View>
          <Pressable
            accessibilityLabel="关闭钻石支付"
            disabled={paying}
            hitSlop={8}
            onPress={() => void onClose()}
            style={styles.paymentClose}
          >
            <View style={styles.paymentCloseIcon}>
              <Dismiss16Regular color="#CCCCCC" width={15} height={15} />
            </View>
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
                {balance === null ? (balanceFailed ? "加载失败" : "...") : balance}
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
          onPress={pay}
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
    fontSize: 16,
    fontWeight: "500",
    lineHeight: 24,
  },
  paymentModalHint: {
    color: "#808080",
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
  paymentCloseIcon: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
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
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 22,
    textAlign: "right",
  },
  paymentBalanceValue: {
    color: "#FE1F4C",
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
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 22,
  },
});
