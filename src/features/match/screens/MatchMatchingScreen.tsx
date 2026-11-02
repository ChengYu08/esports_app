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

import {
  isMultiCompanionRequest,
  type MatchGame,
} from "@/features/match/api/match.types";
import { MatchCelebrationOverlay } from "@/features/match/components/MatchCelebrationOverlay";
import { MatchLinearGradient } from "@/features/match/components/MatchLinearGradient";
import { MatchPaySheet } from "@/features/match/components/MatchPaySheet";
import { MatchingGrabListView } from "@/features/match/components/MatchingGrabListView";
import { MatchingWaitingView } from "@/features/match/components/MatchingWaitingView";
import { useMatchSelectAndPay } from "@/features/match/hooks/use-match-select-and-pay";
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

  // TODO(临时注释): 支付成功关闭试音房
  // const closeAuditionRoom = session.closeAuditionRoom;
  /** 支付成功：跳订单详情（replace 使返回键回到进匹配前的页面） */
  const handlePaid = useCallback(
    (orderId: string | null) => {
      showToast("支付成功");
      if (orderId) {
        router.replace(`/order/${orderId}?scope=place`);
        return;
      }
      leaveMatchFlow();
    },
    [leaveMatchFlow],
  );

  /** 选人 + 建单 + 支付编排（可复用单元，与语聊房弹窗共用） */
  const selectAndPay = useMatchSelectAndPay({
    requestNo,
    token,
    detail: session.detail,
    candidates: session.candidates,
    selectedGrabIds: session.selectedGrabIds,
    submitting: session.submitting,
    setSubmitting: session.setSubmitting,
    setOrderPending: session.setOrderPending,
    onPaid: handlePaid,
  });

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
            <View style={styles.navRight}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="取消"
                hitSlop={12}
                onPress={openCancelPrompt}
              >
                <Text style={styles.navCancel}>取消</Text>
              </Pressable>
            </View>
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
            onConfirm={selectAndPay.handleConfirm}
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

      <MatchPaySheet {...selectAndPay.paySheetProps} />

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
