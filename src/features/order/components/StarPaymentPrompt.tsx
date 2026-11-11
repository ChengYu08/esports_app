import { useEffect, useRef, useState } from "react";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fetchStarBalance, payCompanionOrder } from "@/features/mine/api/companion-order.api";
import { StarNotEnoughError } from "@/features/match/api/match.api";
import { AppPrompt } from "@/shared/ui/AppPrompt";
import { BottomSheet } from "@/shared/ui/BottomSheet";
import type { OrderItemModel } from "../order.types";

export function StarPaymentPrompt({
  item,
  token,
  onClose,
  onPaid,
  onPaymentFailed,
}: {
  item: OrderItemModel | null;
  token: string | null;
  onClose: () => void;
  onPaid: () => void;
  onPaymentFailed: (message: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [balance, setBalance] = useState<number | null>(null);
  const [paying, setPaying] = useState(false);
  const [prompt, setPrompt] = useState<{
    title?: string;
    message: string;
  } | null>(null);
  const settledRef = useRef(false);

  useEffect(() => {
    if (item && token)
      void fetchStarBalance(token)
        .then(setBalance)
        .catch((error: Error) => setPrompt({ message: error.message }));
  }, [item, token]);

  const pay = async () => {
    if (!item || !token) return;
    const total = Number(item.totalPrice) || 0;
    if ((balance ?? 0) < total) {
      setPrompt({
        title: "余额不足",
        message: "当前钻石余额不足，请充值后再支付",
      });
      return;
    }
    setPaying(true);
    try {
      await payCompanionOrder(Number(item.id), token);
      settledRef.current = true;
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
      const errorMessage = error instanceof Error ? error.message : "支付失败";
      onPaymentFailed(errorMessage);
      if (!settledRef.current) {
        settledRef.current = true;
        onClose();
      }
    } finally {
      setPaying(false);
    }
  };

  return (
    <>
      <BottomSheet
        scrollable
        visible={Boolean(item)}
        onClose={onClose}
        contentStyle={[
          styles.paymentSheet,
          { paddingBottom: 24 + insets.bottom },
        ]}
        overlay={
          <AppPrompt
            inline
            visible={Boolean(prompt)}
            title={prompt?.title ?? "支付提示"}
            message={prompt?.message ?? ""}
            confirmText={prompt?.title === "余额不足" ? "去充值" : "知道了"}
            cancelText={prompt?.title === "余额不足" ? "取消" : undefined}
            onCancel={
              prompt?.title === "余额不足" ? () => setPrompt(null) : undefined
            }
            onConfirm={() => {
              const goRecharge = prompt?.title === "余额不足";
              setPrompt(null);
              if (!goRecharge) {
                return;
              }
              // 去充值前先关掉支付弹窗，否则原生 Modal 会盖住跳转后的充值页
              onClose();
              router.push("/star-recharge");
            }}
          />
        }
      >
        <Text style={styles.paymentTitle}>钻石支付</Text>
        <Text style={styles.paymentAmount}>
          支付 {item?.totalPrice ?? 0} 钻石
        </Text>
        <Text style={styles.paymentBalance}>
          当前余额：{balance === null ? "加载中..." : `${balance} 钻石`}
        </Text>
        <View style={styles.paymentActions}>
          <Pressable
            style={styles.paymentCancel}
            onPress={onClose}
          >
            <Text>取消</Text>
          </Pressable>
          <Pressable
            style={styles.paymentConfirm}
            disabled={paying || balance === null}
            onPress={pay}
          >
            <Text style={styles.paymentConfirmText}>
              {paying ? "支付中..." : "确认支付"}
            </Text>
          </Pressable>
        </View>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  paymentSheet: {
    padding: 24,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: "#fff",
  },
  paymentTitle: {
    color: "#111",
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },
  paymentAmount: {
    marginTop: 24,
    color: "#111",
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  paymentBalance: {
    marginTop: 12,
    color: "#777",
    fontSize: 14,
    textAlign: "center",
  },
  paymentActions: { flexDirection: "row", gap: 12, marginTop: 24 },
  paymentCancel: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F5F5F5",
  },
  paymentConfirm: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FF3158",
  },
  paymentConfirmText: { color: "#fff", fontWeight: "600" },
});
