import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";

import {
  batchPayQuickMatch,
  fetchQuickMatchPayable,
} from "@/features/match/api/match.api";
import { fetchStarBalance } from "@/features/mine/api/companion-order.api";
import { AppPrompt } from "@/shared/ui/AppPrompt";
import { BottomSheet } from "@/shared/ui/BottomSheet";
import { DOUYIN_SANS } from "@/shared/theme/typography";

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
        scrollable
        contentStyle={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}
      >
        <Text style={styles.title}>星钻支付</Text>
        <Text style={styles.hint}>请在5分钟内支付，否则订单自动取消</Text>
        <Text style={styles.amount}>支付 {totalPrice} 星钻</Text>
        <Text style={styles.balance}>
          当前余额：{balance === null ? "加载中..." : `${balance} 星钻`}
        </Text>
        <View style={styles.actions}>
          <Pressable style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelText}>取消</Text>
          </Pressable>
          <Pressable
            style={styles.confirm}
            disabled={paying || balance === null}
            onPress={() => void pay()}
          >
            <Text style={styles.confirmText}>{paying ? "支付中..." : "确认支付"}</Text>
          </Pressable>
        </View>
      </BottomSheet>

      <AppPrompt
        visible={Boolean(prompt)}
        title={prompt?.title}
        message={prompt?.message ?? ""}
        confirmText={prompt?.title === "余额不足" ? "去充值" : "知道了"}
        cancelText={prompt?.title === "余额不足" ? "取消" : undefined}
        onCancel={
          prompt?.title === "余额不足"
            ? () => setPrompt(null)
            : undefined
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
    padding: 24,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: "#FFFFFF",
  },
  title: {
    fontFamily: DOUYIN_SANS,
    fontSize: 18,
    fontWeight: "600",
    color: "#111111",
    textAlign: "center",
  },
  hint: {
    marginTop: 8,
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    lineHeight: 18,
    color: "#999999",
    textAlign: "center",
  },
  amount: {
    marginTop: 24,
    fontFamily: DOUYIN_SANS,
    fontSize: 22,
    fontWeight: "700",
    color: "#111111",
    textAlign: "center",
  },
  balance: {
    marginTop: 12,
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    color: "#777777",
    textAlign: "center",
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
  },
  cancel: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F5F5F5",
  },
  cancelText: {
    fontFamily: DOUYIN_SANS,
    fontSize: 15,
    fontWeight: "600",
    color: "#333333",
  },
  confirm: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FF3158",
  },
  confirmText: {
    fontFamily: DOUYIN_SANS,
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
