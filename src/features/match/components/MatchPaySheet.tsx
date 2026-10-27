import { Dismiss16Regular } from "@fluentui/react-native-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  batchPayQuickMatch,
  fetchQuickMatchPayable,
} from "@/features/match/api/match.api";
import { MatchLinearGradient } from "@/features/match/components/MatchLinearGradient";
import { fetchStarBalance } from "@/features/mine/api/companion-order.api";
import { DOUYIN_SANS } from "@/shared/theme/typography";
import { AppPrompt } from "@/shared/ui/AppPrompt";
import { BottomSheet } from "@/shared/ui/BottomSheet";

const CONFIRM_GRADIENT = ["#FF1F2E", "#FF1F69"] as const;
const diamondIcon = require("../../../../assets/mine/figma/star-recharge-diamond-3f6fcf.png");

type MatchPaySheetProps = {
  visible: boolean;
  requestNo: string | null;
  token: string | null;
  fallbackTotal: number;
  onClose: () => void;
  onPaid: () => void;
};

export function MatchPaySheet({
  visible,
  requestNo,
  token,
  fallbackTotal,
  onClose,
  onPaid,
}: MatchPaySheetProps) {
  const insets = useSafeAreaInsets();
  const [balance, setBalance] = useState<number | null>(null);
  const [totalPrice, setTotalPrice] = useState(fallbackTotal);
  const [paying, setPaying] = useState(false);
  const [prompt, setPrompt] = useState<{ title?: string; message: string } | null>(null);
  const payDisabled = paying || balance === null;

  useEffect(() => {
    if (!visible || !token || !requestNo) return;
    setBalance(null);
    setTotalPrice(fallbackTotal);
    void fetchStarBalance(token)
      .then(setBalance)
      .catch((error: Error) => setPrompt({ message: error.message }));
    void fetchQuickMatchPayable(requestNo, token)
      .then((payable) => setTotalPrice(payable.totalPrice))
      .catch(() => {
        // 保留建单返回的 fallbackTotal
      });
  }, [fallbackTotal, requestNo, token, visible]);

  async function pay() {
    if (!token || !requestNo) {
      setPrompt({ message: "请先登录" });
      return;
    }
    if ((balance ?? 0) < totalPrice) {
      setPrompt({
        title: "余额不足",
        message: "当前星钻余额不足，请充值后再支付",
      });
      return;
    }
    setPaying(true);
    try {
      await batchPayQuickMatch(requestNo, token);
      onPaid();
    } catch (error) {
      setPrompt({
        message: error instanceof Error ? error.message : "支付失败",
      });
    } finally {
      setPaying(false);
    }
  }

  return (
    <>
      <BottomSheet
        visible={visible}
        onClose={onClose}
        dismissOnBackdropPress={!paying}
        contentStyle={[
          styles.sheet,
          { paddingBottom: Math.max(insets.bottom, 12) + 12 },
        ]}
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>星钻支付</Text>
            <Text style={styles.hint}>请在5分钟内支付，否则订单自动取消</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="关闭"
            disabled={paying}
            hitSlop={8}
            onPress={onClose}
            style={styles.closeButton}
          >
            <View style={styles.closeIcon}>
              <Dismiss16Regular color="rgba(0, 0, 0, 0.2)" width={15} height={15} />
            </View>
          </Pressable>
        </View>

        <View style={styles.rows}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>订单合计</Text>
            <View style={styles.rowValue}>
              <Text style={styles.totalValue}>{totalPrice}</Text>
              <Image source={diamondIcon} style={styles.diamondIcon} />
            </View>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>我的星钻</Text>
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
          onPress={() => void pay()}
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
    fontFamily: DOUYIN_SANS,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "500",
    color: "#0A0A0A",
  },
  hint: {
    fontFamily: DOUYIN_SANS,
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
    fontFamily: DOUYIN_SANS,
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
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "500",
    color: "#0A0A0A",
    textAlign: "right",
  },
  balanceValue: {
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "500",
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
    fontFamily: DOUYIN_SANS,
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
