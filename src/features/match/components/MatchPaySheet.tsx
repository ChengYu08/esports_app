import { Dismiss16Regular } from "@fluentui/react-native-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type {
  QuickMatchCreatedOrder,
  QuickMatchPaymentPreview,
} from "@/features/match/api/match.types";
import { MatchLinearGradient } from "@/features/match/components/MatchLinearGradient";
import {
  confirmQuickMatchPay,
  type ConfirmPayState,
} from "@/features/match/quick-match-confirm-pay";
import { useStarBalance } from "@/features/mine/hooks/use-star-balance";
import { getDDinProStyle } from "@/shared/theme/typography";
import { AppPrompt } from "@/shared/ui/AppPrompt";
import { BottomSheet } from "@/shared/ui/BottomSheet";

const CONFIRM_GRADIENT = ["#FF1F2E", "#FF1F69"] as const;
const diamondIcon = require("../../../../assets/mine/star-recharge-diamond-3f6fcf.png");

type MatchPaySheetProps = {
  visible: boolean;
  requestNo: string | null;
  token: string | null;
  /** 建单前支付明细预览（点"确定选择"时获取） */
  preview: QuickMatchPaymentPreview | null;
  /** 预览时的选择快照，建单按快照执行 */
  selectionSnapshot: string[];
  /** 当前选择是否仍与快照一致（防御校验） */
  selectionMatchesSnapshot: () => boolean;
  /** 关闭弹窗；ordersCreated 表示已建单未支付 */
  onClose: (phase: "previewing" | "ordersCreated") => void;
  /** 建单成功：父级置 orderPending 防止超时/结束信令清会话 */
  onOrdersCreated: () => void;
  onPaid: (orders: QuickMatchCreatedOrder[]) => void;
};

export function MatchPaySheet({
  visible,
  requestNo,
  token,
  preview,
  selectionSnapshot,
  selectionMatchesSnapshot,
  onClose,
  onOrdersCreated,
  onPaid,
}: MatchPaySheetProps) {
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<ConfirmPayState>(() => ({
    ordersCreated: false,
    expectedTotal:
      preview?.paymentMethods[0]?.payableAmount ?? preview?.totalPrice ?? 0,
    orders: [],
  }));
  const [paying, setPaying] = useState(false);
  const [prompt, setPrompt] = useState<{
    title?: string;
    message: string;
  } | null>(null);

  // 初始余额取预览快照；充值返回后由 useStarBalance 在页面 focus 时刷新
  const method = preview?.paymentMethods[0];
  const balance = useStarBalance(token, visible && Boolean(preview), {
    initialBalance: method?.balance ?? null,
  });
  const payDisabled = paying || balance === null;

  async function confirmPay() {
    if (paying || !preview || !token || !requestNo) return;
    setPaying(true);
    try {
      const next = await confirmQuickMatchPay(state, {
        requestNo,
        token,
        grabIds: selectionSnapshot,
        balance: balance ?? 0,
        selectionMatchesSnapshot,
        onSelectionChanged: () => onClose("previewing"),
        onOrdersCreated,
        onBalanceInsufficient: () => {
          setPrompt({
            title: "余额不足",
            message: "当前钻石余额不足，请充值后再支付",
          });
        },
        onPaid: (orders) => onPaid(orders),
      });
      setState(next);
    } finally {
      setPaying(false);
    }
  }

  const discountAmount = method?.discountAmount ?? 0;
  const showDiscounted = discountAmount > 0;
  const originalTotal = preview?.totalPrice ?? 0;
  const totalValue = state.expectedTotal;

  return (
    <>
      <BottomSheet
        visible={visible}
        onClose={() =>
          onClose(state.ordersCreated ? "ordersCreated" : "previewing")
        }
        dismissOnBackdropPress={!paying}
        contentStyle={[
          styles.sheet,
          { paddingBottom: Math.max(insets.bottom, 12) + 12 },
        ]}
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>钻石支付</Text>
            {state.ordersCreated ? (
              <Text style={styles.hint}>请在5分钟内支付，否则订单自动取消</Text>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="关闭"
            disabled={paying}
            hitSlop={8}
            onPress={() =>
              onClose(state.ordersCreated ? "ordersCreated" : "previewing")
            }
            style={styles.closeButton}
          >
            <View style={styles.closeIcon}>
              <Dismiss16Regular
                color="rgba(0, 0, 0, 0.2)"
                width={15}
                height={15}
              />
            </View>
          </Pressable>
        </View>

        <View style={styles.rows}>
          {showDiscounted ? (
            <>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>订单原价</Text>
                <View style={styles.rowValue}>
                  <Text style={styles.totalValue}>{originalTotal}</Text>
                  <Image source={diamondIcon} style={styles.diamondIcon} />
                </View>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>优惠减免</Text>
                <View style={styles.rowValue}>
                  <Text style={styles.totalValue}>{discountAmount}</Text>
                  <Image source={diamondIcon} style={styles.diamondIcon} />
                </View>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>实付金额</Text>
                <View style={styles.rowValue}>
                  <Text style={styles.totalValue}>{totalValue}</Text>
                  <Image source={diamondIcon} style={styles.diamondIcon} />
                </View>
              </View>
            </>
          ) : (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>订单合计</Text>
              <View style={styles.rowValue}>
                <Text style={styles.totalValue}>{totalValue}</Text>
                <Image source={diamondIcon} style={styles.diamondIcon} />
              </View>
            </View>
          )}
          <View style={styles.row}>
            <Text style={styles.rowLabel}>我的钻石</Text>
            <View style={styles.rowValue}>
              <Text style={styles.balanceValue}>
                {balance === null ? "..." : balance}
              </Text>
              <Image source={diamondIcon} style={styles.diamondIcon} />
            </View>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="确认支付"
          accessibilityState={{ disabled: payDisabled }}
          disabled={payDisabled}
          onPress={confirmPay}
          style={({ pressed }) => [
            styles.confirmWrap,
            pressed && !payDisabled && styles.pressed,
            payDisabled && styles.confirmDisabled,
          ]}
        >
          <MatchLinearGradient
            colors={CONFIRM_GRADIENT}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.confirm}
          >
            <Text style={styles.confirmText}>
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
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    overflow: "hidden",
  },
  header: {
    minHeight: 56,
    position: "relative",
    paddingTop: 16,
    paddingBottom: 8,
    paddingHorizontal: 16,
    paddingRight: 48,
  },
  headerText: {
    gap: 8,
  },
  title: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "500",
    color: "#0A0A0A",
  },
  hint: {
    fontSize: 12,
    lineHeight: 18,
    color: "#808080",
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
  closeIcon: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  rows: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  rowLabel: {
    width: 96,
    fontSize: 14,
    lineHeight: 22,
    color: "#666666",
  },
  rowValue: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  totalValue: {
    fontSize: 14,
    lineHeight: 22,
    color: "#0A0A0A",
    textAlign: "right",
    ...getDDinProStyle(500),
  },
  balanceValue: {
    fontSize: 14,
    lineHeight: 22,
    ...getDDinProStyle(500),
    color: "#FE1F4C",
    textAlign: "right",
  },
  diamondIcon: {
    width: 16,
    height: 16,
  },
  confirmWrap: {
    marginHorizontal: 16,
    marginTop: 8,
  },
  confirm: {
    height: 42,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  confirmText: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "500",
    color: "#FFFFFF",
  },
  confirmDisabled: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.9,
  },
});
