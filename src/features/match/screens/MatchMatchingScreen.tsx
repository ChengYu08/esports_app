import { useAuthStore } from "@esports/auth";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft24Regular } from "@fluentui/react-native-icons";
import { Image } from "expo-image";
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

import { fetchClubGameServices, fetchQuickMatchPaymentPreview } from "@/features/match/api/match.api";
import {
  isMultiCompanionRequest,
  type MatchGame,
  type QuickMatchCreatedOrder,
  type QuickMatchPaymentPreview,
} from "@/features/match/api/match.types";
import { MatchCelebrationOverlay } from "@/features/match/components/MatchCelebrationOverlay";
import { MatchPaySheet } from "@/features/match/components/MatchPaySheet";
import { MatchingGrabListView } from "@/features/match/components/MatchingGrabListView";
import { MatchingWaitingView } from "@/features/match/components/MatchingWaitingView";
import { useQuickMatchSession } from "@/features/match/hooks/use-quick-match-session";
import { afterOrderPaidOpenChat, afterQuickMatchPaidOpenRoom } from "@/features/order/notify-order-paid";
import { AppPrompt } from "@/shared/ui/AppPrompt";
import { showToast } from "@/shared/ui/app-toast";

const bgPublishDark = require("../../../../assets/images/bg_publish_dark.webp");

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
  /** 建单前支付明细预览（对齐 PC：先看明细，确认支付才建单） */
  const [payPreview, setPayPreview] = useState<QuickMatchPaymentPreview | null>(null);
  /** 预览时的选择快照，建单与订单匹配均按快照执行 */
  const [selectionSnapshot, setSelectionSnapshot] = useState<string[]>([]);
  /** 每次发起预览自增，作为支付弹窗的 key 强制重置内部状态 */
  const [paySessionId, setPaySessionId] = useState(0);
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

  const levelId = session.detail?.gameLevelId;
  const serviceId = session.detail?.gameServiceId;
  const servicesQuery = useQuery({
    queryKey: ["quick-match", "services", token, levelId],
    queryFn: ({ signal }) => fetchClubGameServices(levelId as string, token as string, signal),
    enabled: Boolean(token && levelId && serviceId),
  });
  const selectedService = servicesQuery.data?.find((service) => service.id === serviceId);

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
    if (!token) {
      return;
    }
    if (session.submitting) {
      return;
    }
    if (!session.selectedGrabIds.length) {
      showToast("请先选择陪玩");
      return;
    }
    session.setSubmitting(true);
    try {
      const preview = await fetchQuickMatchPaymentPreview(
        requestNo,
        [...session.selectedGrabIds],
        token,
      );
      setSelectionSnapshot([...session.selectedGrabIds]);
      setPayPreview(preview);
      setPaySessionId((id) => id + 1);
      session.setSelectionLocked(true);
      setPayVisible(true);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "支付明细预览获取失败");
    } finally {
      session.setSubmitting(false);
    }
  }, [requestNo, session, token]);

  /** 支付弹窗关闭：未建单回匹配继续选人；已建单提示去订单中心补付 */
  const handlePaySheetClose = useCallback(
    (phase: "previewing" | "ordersCreated") => {
      setPayVisible(false);
      setPayPreview(null);
      session.setSelectionLocked(false);
      if (phase === "ordersCreated") {
        showToast("订单已创建，请在5分钟内到订单中心支付");
        leaveMatchFlow();
      }
    },
    [leaveMatchFlow, session],
  );

  // TODO(临时注释): 支付成功关闭试音房
  // const closeAuditionRoom = session.closeAuditionRoom;
  const handlePaid = useCallback(
    (orders: QuickMatchCreatedOrder[]) => {
      setPayVisible(false);
      setPayPreview(null);
      session.setSelectionLocked(false);
      showToast("支付成功");
      const companionUserIds: string[] = [];
      for (const order of orders) {
        const uid = order.serviceUserId;
        if (!uid || uid === "0" || companionUserIds.includes(uid)) {
          continue;
        }
        companionUserIds.push(uid);
      }
      if (token && session.detail?.needVoice === false) {
        afterQuickMatchPaidOpenRoom({
          companionUserIds,
          token,
          clubId: session.detail.clubId,
          returnToOrders: true,
        });
        return;
      }
      const firstCompanionId = companionUserIds[0];
      if (!firstCompanionId) {
        leaveMatchFlow();
        return;
      }
      const firstCandidate = session.candidates.find(
        (item) => item.companionUserId === firstCompanionId,
      );
      // replace：用聊天页替换匹配页；多陪玩时仅打开首位会话，其余只发消息
      void afterOrderPaidOpenChat({
        companionUserIds,
        token,
        navigate: "replace",
        chat: {
          id: firstCompanionId,
          title: firstCandidate?.nickname || "用户聊天",
          avatar: firstCandidate?.headImage,
          clubId: session.detail?.clubId
            ? String(session.detail.clubId)
            : undefined,
        },
      });
    },
    [leaveMatchFlow, session, token],
  );

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <Stack.Screen options={{ headerShown: false }} />
      <Image
        source={bgPublishDark}
        style={styles.background}
        contentFit="fill"
        pointerEvents="none"
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
            multiCompanion={isMultiCompanionRequest(session.detail, selectedService)}
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
        key={paySessionId}
        visible={payVisible}
        requestNo={requestNo}
        token={token}
        preview={payPreview}
        selectionSnapshot={selectionSnapshot}
        selectionMatchesSnapshot={() =>
          selectionSnapshot.length === session.selectedGrabIds.length &&
          selectionSnapshot.every((id) => session.selectedGrabIds.includes(id))
        }
        onClose={handlePaySheetClose}
        onOrdersCreated={() => session.setOrderPending(true)}
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
    fontSize: 14,
    lineHeight: 22,
    color: "#FFFFFF",
  },
  body: {
    flex: 1,
  },
});
