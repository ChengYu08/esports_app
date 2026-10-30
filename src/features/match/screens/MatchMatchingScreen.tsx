import { useAuthStore } from "@esports/auth";
import { ChevronLeft24Regular } from "@fluentui/react-native-icons";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { selectAndCreateOrder } from "@/features/match/api/match.api";
import {
  isMultiCompanionRequest,
  type MatchGame,
} from "@/features/match/api/match.types";
import { MatchCelebrationOverlay } from "@/features/match/components/MatchCelebrationOverlay";
import { MatchLinearGradient } from "@/features/match/components/MatchLinearGradient";
import { MatchPaySheet } from "@/features/match/components/MatchPaySheet";
import { MatchingGrabListView } from "@/features/match/components/MatchingGrabListView";
import { MatchingWaitingView } from "@/features/match/components/MatchingWaitingView";
import { useQuickMatchSession } from "@/features/match/hooks/use-quick-match-session";
import { DOUYIN_SANS } from "@/shared/theme/typography";
import { AppPrompt } from "@/shared/ui/AppPrompt";
import { showToast } from "@/shared/ui/app-toast";

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
  const { width, height } = useWindowDimensions();
  const token = useAuthStore((state) => state.accessToken);
  const [payVisible, setPayVisible] = useState(false);
  const [payTotal, setPayTotal] = useState(0);
  const [paidOrderId, setPaidOrderId] = useState<string | null>(null);
  const [cancelPromptVisible, setCancelPromptVisible] = useState(false);
  /** 首位候选人出现的短暂庆祝动效 */
  const [celebrating, setCelebrating] = useState(false);
  /** 已经触发过庆祝，避免轮询追加候选人重复播 */
  const celebratedRef = useRef(false);

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

  // 首个陪玩出现时短暂播一段庆祝动效（一次性）
  useEffect(() => {
    if (!hasCandidates || celebratedRef.current) return;
    celebratedRef.current = true;
    setCelebrating(true);
    const timer = setTimeout(() => setCelebrating(false), 900);
    return () => clearTimeout(timer);
  }, [hasCandidates]);

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
      showToast("请先选择陪玩");
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
      showToast(error instanceof Error ? error.message : "创建订单失败");
    } finally {
      session.setSubmitting(false);
    }
  }, [requestNo, session, token]);

  // TODO(临时注释): 支付成功关闭试音房
  // const closeAuditionRoom = session.closeAuditionRoom;
  const handlePaid = useCallback(() => {
    setPayVisible(false);
    showToast("支付成功");
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
      <StatusBar style="light" />
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
            <ChevronLeft24Regular
              color="white"
              width={24}
              height={24}
              style={styles.backIcon}
            />
          </Pressable>
          <Animated.Text
            key={hasCandidates ? "grab" : "waiting"}
            entering={FadeIn.duration(220)}
            style={styles.navTitle}
          >
            {hasCandidates ? "选择陪玩" : "一键匹配"}
          </Animated.Text>
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
            countdownSec={session.countdownSec}
            candidates={session.candidates}
            newCandidateIds={session.newCandidateIds}
            selectedGrabIds={session.selectedGrabIds}
            submitting={session.submitting}
            multiCompanion={isMultiCompanionRequest(session.detail)}
            onSelect={session.toggleGrab}
            onConfirm={() => void handleSelectAndOrder()}
          />
        ) : (
          <MatchingWaitingView
            countdownText={session.countdownText}
            countdownSec={session.countdownSec}
            game={game}
            onCancel={openCancelPrompt}
          />
        )}
      </View>

      {celebrating ? (
        <MatchCelebrationOverlay
          centeredOn={{ x: width / 2, y: (insets.top + 44 + height) * 0.45 }}
        />
      ) : null}

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
