import { useAuthStore } from "@esports/auth";
import { Image } from "expo-image";
import { Stack, router } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Toast from "react-native-root-toast";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { selectAndCreateOrder } from "@/features/match/api/match.api";
import type { MatchGame } from "@/features/match/api/match.types";
import { MatchLinearGradient } from "@/features/match/components/MatchLinearGradient";
import { MatchPaySheet } from "@/features/match/components/MatchPaySheet";
import { MatchingGrabListView } from "@/features/match/components/MatchingGrabListView";
import { MatchingWaitingView } from "@/features/match/components/MatchingWaitingView";
import { useQuickMatchSession } from "@/features/match/hooks/use-quick-match-session";
import { AppPrompt } from "@/shared/ui/AppPrompt";
import { DOUYIN_SANS } from "@/shared/theme/typography";

const backIcon = require("../../../../assets/match/icon-back.svg");
const BG_GRADIENT = ["#0C0C2E", "#120D2B"] as const;

type MatchMatchingScreenProps = {
  requestNo: string;
  expireTime?: string;
  game?: MatchGame | null;
};

export default function MatchMatchingScreen({
  requestNo,
  expireTime,
  game,
}: MatchMatchingScreenProps) {
  const insets = useSafeAreaInsets();
  const token = useAuthStore((state) => state.accessToken);
  const [payVisible, setPayVisible] = useState(false);
  const [payTotal, setPayTotal] = useState(0);
  const [paidOrderId, setPaidOrderId] = useState<string | null>(null);
  const [cancelPromptVisible, setCancelPromptVisible] = useState(false);

  /** 按路由栈返回进入匹配前的页面；无可返回时回 tabs */
  const leaveMatchFlow = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  }, []);

  const handleEnded = useCallback(() => {
    leaveMatchFlow();
  }, [leaveMatchFlow]);

  const session = useQuickMatchSession(requestNo, {
    expireTime: expireTime || undefined,
    onEnded: handleEnded,
  });

  const hasCandidates = session.candidates.length > 0;
  const openCancelPrompt = useCallback(() => {
    setCancelPromptVisible(true);
  }, []);

  const handleSelectAndOrder = useCallback(async () => {
    if (!token) return;
    if (session.orderPending) {
      setPayVisible(true);
      return;
    }
    if (!session.selectedGrabIds.length) {
      Toast.show("请先选择陪玩", { duration: Toast.durations.SHORT });
      return;
    }
    if (session.submitting) return;
    const firstGrabId = session.selectedGrabIds[0];
    const firstCompanionUserId = session.candidates.find(
      (item) => item.id === firstGrabId,
    )?.companionUserId;
    session.setSubmitting(true);
    try {
      const created = await selectAndCreateOrder(
        requestNo,
        session.selectedGrabIds,
        token,
      );
      const matchedOrder = firstCompanionUserId
        ? created.orders.find(
            (order) => order.serviceUserId === firstCompanionUserId,
          )
        : undefined;
      setPaidOrderId(matchedOrder?.orderId ?? null);
      session.setOrderPending(true);
      setPayTotal(created.totalPrice);
      setPayVisible(true);
    } catch (error) {
      Toast.show(error instanceof Error ? error.message : "创建订单失败", {
        duration: Toast.durations.SHORT,
      });
    } finally {
      session.setSubmitting(false);
    }
  }, [requestNo, session, token]);

  // TODO(临时注释): 支付成功关闭试音房
  // const closeAuditionRoom = session.closeAuditionRoom;
  const handlePaid = useCallback(() => {
    setPayVisible(false);
    Toast.show("支付成功", { duration: Toast.durations.SHORT });
    // void (async () => {
    //   await closeAuditionRoom();
    //   leaveMatchFlow();
    // })();
    if (paidOrderId) {
      // replace：用订单详情替换匹配页，返回键回到进入匹配前的页面
      router.replace(`/order/${paidOrderId}?scope=place`);
      return;
    }
    leaveMatchFlow();
  }, [leaveMatchFlow, paidOrderId]);

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <MatchLinearGradient
        colors={BG_GRADIENT}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.background}
      />

      <View style={[styles.nav, { paddingTop: insets.top }]}>
        <View style={styles.navBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="返回"
            hitSlop={12}
            onPress={leaveMatchFlow}
            style={styles.backButton}
          >
            <Image source={backIcon} style={styles.backIcon} />
          </Pressable>
          <Text style={styles.navTitle}>
            {hasCandidates ? "选择陪玩" : "一键匹配"}
          </Text>
          {hasCandidates ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="取消"
              hitSlop={12}
              onPress={openCancelPrompt}
              style={styles.navRight}
            >
              <Text style={styles.navCancel}>取消</Text>
            </Pressable>
          ) : (
            <View style={styles.navRight} />
          )}
        </View>
      </View>

      <View style={styles.body}>
        {hasCandidates ? (
          <MatchingGrabListView
            countdownText={session.countdownText}
            candidates={session.candidates}
            selectedGrabIds={session.selectedGrabIds}
            submitting={session.submitting}
            onSelect={session.toggleGrab}
            onConfirm={() => void handleSelectAndOrder()}
          />
        ) : (
          <MatchingWaitingView
            countdownText={session.countdownText}
            game={game}
            onCancel={openCancelPrompt}
          />
        )}
      </View>

      <MatchPaySheet
        visible={payVisible}
        requestNo={requestNo}
        token={token}
        fallbackTotal={payTotal}
        onClose={() => setPayVisible(false)}
        onPaid={handlePaid}
      />

      <AppPrompt
        visible={cancelPromptVisible}
        title="提示"
        message="确定取消当前派单吗？"
        confirmText="取消派单"
        cancelText="继续等待"
        onCancel={() => setCancelPromptVisible(false)}
        onConfirm={() => {
          setCancelPromptVisible(false);
          void session.cancelMatching();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0C0C2E",
  },
  background: {
    ...StyleSheet.absoluteFill,
  },
  nav: {
    width: "100%",
  },
  navBar: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    width: 56,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  backIcon: {
    width: 24,
    height: 24,
  },
  navTitle: {
    flex: 1,
    fontFamily: DOUYIN_SANS,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
    color: "#FFFFFF",
    textAlign: "center",
  },
  navRight: {
    minWidth: 56,
    height: 44,
    paddingRight: 16,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  navCancel: {
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    lineHeight: 22,
    color: "#FFFFFF",
  },
  body: {
    flex: 1,
  },
});
