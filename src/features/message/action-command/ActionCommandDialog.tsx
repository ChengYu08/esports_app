import { useAuthStore } from "@esports/auth";
import { router } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-root-toast";

import { DOUYIN_SANS } from "@/shared/theme/typography";
import { acceptOrder } from "@/features/order/order.api";
import { useActionCommandDialog } from "./action-command-store";
import { releaseOrderPayKey } from "./action-command-handlers";

const CLOSE_ICON = require("../../../../assets/svgs/icon-close.svg");

/** ORDER_NOTIFY 支付催单弹窗（RC:CmdMsg 信令）：头像 + 文案 + 接单按钮，不自动关 */
export function ActionCommandDialog() {
  const insets = useSafeAreaInsets();
  const current = useActionCommandDialog((state) => state.current);
  const dismiss = useActionCommandDialog((state) => state.dismiss);
  const [claiming, setClaiming] = useState(false);

  if (!current) return null;

  const handleAcceptOrder = async () => {
    if (claiming) return;
    const { orderId, orderNo } = current;
    setClaiming(true);
    try {
      const { accessToken } = useAuthStore.getState();
      if (!accessToken) {
        Toast.show("请先登录", { duration: Toast.durations.SHORT });
        return;
      }
      await acceptOrder(orderId, accessToken);
      releaseOrderPayKey(orderNo);
      dismiss();
      Toast.show("接单成功", { duration: Toast.durations.SHORT });
      router.push({ pathname: "/order/[id]", params: { id: orderId } });
    } catch (error) {
      Toast.show(
        error instanceof Error && error.message ? error.message : "接单失败，请稍后重试",
        { duration: Toast.durations.SHORT },
      );
    } finally {
      setClaiming(false);
    }
  };

  const handleClose = () => {
    releaseOrderPayKey(current.orderNo);
    dismiss();
  };

  return (
    <Animated.View
      entering={FadeInDown.duration(250)}
      exiting={FadeOutUp.duration(200)}
      pointerEvents="box-none"
      style={[styles.overlay, { top: insets.top + 12 }]}
    >
      <View style={styles.shadow}>
        <LinearGradient
          colors={["#2F2759", "#231E4B", "#0C0C2E"]}
          end={{ x: 0.996, y: 0.565 }}
          locations={[0.004, 0.805, 1]}
          start={{ x: 0.004, y: 0.435 }}
          style={styles.card}
        >
          <View style={styles.orderPayRow}>
            <Image
              contentFit="cover"
              source={current.buyerHeadImage ? { uri: current.buyerHeadImage } : undefined}
              style={styles.avatar}
            />
            <Text style={styles.orderPayMessage}>
              {current.buyerNickname || "老板"}已支付订单，请尽快接单!
            </Text>
            <Pressable
              accessibilityLabel="关闭支付催单弹窗"
              accessibilityRole="button"
              hitSlop={8}
              onPress={handleClose}
              style={({ pressed }) => [styles.closeAction, pressed && styles.actionPressed]}
            >
              <Image contentFit="contain" source={CLOSE_ICON} style={styles.closeIcon} />
            </Pressable>
          </View>
          <View style={styles.actions}>
            <Pressable
              accessibilityLabel="接单"
              accessibilityRole="button"
              disabled={claiming}
              hitSlop={8}
              onPress={() => {
                void handleAcceptOrder();
              }}
              style={({ pressed }) => [styles.primaryAction, pressed && styles.actionPressed]}
            >
              <Text style={styles.primaryActionText}>{claiming ? "接单中…" : "接单"}</Text>
            </Pressable>
          </View>
        </LinearGradient>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 1100,
    elevation: 1100,
  },
  shadow: {
    borderRadius: 16,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 8,
  },
  card: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  orderPayRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    flexShrink: 0,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  orderPayMessage: {
    flex: 1,
    minWidth: 0,
    color: "#FFFFFF",
    fontFamily: DOUYIN_SANS,
    fontSize: 13,
    lineHeight: 19,
  },
  closeAction: {
    flexShrink: 0,
    padding: 4,
  },
  closeIcon: {
    width: 14,
    height: 14,
    tintColor: "rgba(255,255,255,0.72)",
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  primaryAction: {
    paddingHorizontal: 20,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: "#7C5CFF",
  },
  primaryActionText: {
    color: "#FFFFFF",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18,
  },
  actionPressed: { opacity: 0.78 },
});
