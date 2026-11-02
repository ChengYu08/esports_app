import { ChevronLeft24Regular } from "@fluentui/react-native-icons";
import { useAuthStore } from "@esports/auth";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ApiError } from "@/core/network/api-client";
import { setPendingActivityRules } from "@/features/activity/activity-rules-transfer";
import { computeActivityStatus } from "@/features/activity/activity-status";
import { publishActivity } from "@/features/activity/api/activity.api";
import {
  formatCountdown,
  useActivityCountdown,
  useActivityDetail,
} from "@/features/activity/hooks/use-activity-detail";
import { openAuditionRoom } from "@/features/match/enter-audition-room";
import { requireLogin } from "@/shared/navigation/require-login";
import { showToast } from "@/shared/ui/app-toast";

const BG_COLOR = "#0C0C2E";
const ACCENT_COLOR = "#FE4267";
const FOOTER_CONTENT_BOTTOM = 22;
const COUNTDOWN_OVERLAP = 17;

/** ISO-8601 时间格式化为 MM-dd HH:mm（用于开抢时间展示）。 */
function formatStartAt(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) {
    return iso;
  }
  const date = new Date(ms);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function ActivityLandingScreen({ activityCode }: { activityCode: string }) {
  const insets = useSafeAreaInsets();
  const token = useAuthStore((state) => state.accessToken);
  const detailQuery = useActivityDetail(activityCode);
  const detail = detailQuery.data ?? null;

  const { nowMs, offsetMs } = useActivityCountdown(detail?.serverTime);

  const [publishing, setPublishing] = useState(false);

  const computed = useMemo(() => {
    if (!detail) {
      return null;
    }
    return computeActivityStatus(
      {
        startTime: detail.startTime,
        endTime: detail.endTime,
        remainingStock: detail.remainingStock,
        buttonStatus: detail.buttonStatus,
        disabledReason: detail.disabledReason,
      },
      nowMs,
      offsetMs,
    );
  }, [detail, nowMs, offsetMs]);

  // 倒计时：进行中显示距结束剩余，未开始显示距开抢剩余。
  const countdownMs = useMemo(() => {
    if (!detail) {
      return 0;
    }
    const serverNow = nowMs + offsetMs;
    if (computed?.status === "NOT_STARTED") {
      const startMs = Date.parse(detail.startTime);
      return Number.isFinite(startMs) ? startMs - serverNow : 0;
    }
    const endMs = Date.parse(detail.endTime);
    return Number.isFinite(endMs) ? endMs - serverNow : 0;
  }, [computed?.status, detail, nowMs, offsetMs]);

  const goBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  }, []);

  const openRules = useCallback(() => {
    if (!detail?.rules) {
      return;
    }
    setPendingActivityRules(detail.rules);
    router.push("/activity/rules");
  }, [detail?.rules]);

  const retry = useCallback(() => {
    void detailQuery.refetch();
  }, [detailQuery]);

  /** 立即参与：防重 → 登录校验 → 发布活动派单 → 复用统一进房逻辑进试音房。 */
  const handleJoin = useCallback(async () => {
    if (!detail || !computed || publishing) {
      return;
    }
    if (computed.status !== "ACTIVE") {
      return;
    }
    // 登录判断只走 requireLogin（未登录会跳登录页）；!token 仅为通过后的类型收窄。
    if (!requireLogin() || !token) {
      return;
    }
    setPublishing(true);
    try {
      const result = await publishActivity(detail.activityId, token);
      // roomId 为空时 openAuditionRoom 内部走 ensure 兜底分支。
      await openAuditionRoom(result.requestNo, token, {
        expireTime: result.expireTime || undefined,
      });
    } catch (error) {
      if (error instanceof ApiError && error.code === "NOT_LOGGED_IN") {
        requireLogin();
        return;
      }
      showToast(error instanceof Error ? error.message : "参与活动失败，请重试");
    } finally {
      setPublishing(false);
    }
  }, [computed, detail, publishing, token]);

  const buttonLabel = useMemo(() => {
    if (publishing) {
      return "参与中...";
    }
    if (!computed) {
      return "立即参与";
    }
    if (computed.status === "NOT_STARTED") {
      return `开抢时间 ${formatStartAt(detail?.startTime || "")}`;
    }
    if (computed.status === "SOLD_OUT") {
      return "已抢光";
    }
    if (computed.status === "DISABLED") {
      return computed.disabledReason || "活动暂不可参与";
    }
    return detail?.actionText || "立即参与";
  }, [computed, detail?.actionText, detail?.startTime, publishing]);

  const joinable = computed?.status === "ACTIVE" && !publishing;
  const showCountdown = computed?.status === "ACTIVE" || computed?.status === "NOT_STARTED";
  const countdownLabel =
    computed?.status === "NOT_STARTED"
      ? `距开抢 ${formatCountdown(countdownMs)}`
      : `活动倒计时 ${formatCountdown(countdownMs)}`;
  const priceUnit = detail?.product.billingUnitName
    ? `钻石/${detail.product.billingUnitName}`
    : "钻石";

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.nav, { paddingTop: insets.top }]}>
        <View style={styles.navBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="返回"
            hitSlop={12}
            onPress={goBack}
            style={styles.backButton}
          >
            <ChevronLeft24Regular color="white" width={24} height={24} style={styles.backIcon} />
          </Pressable>
          <View style={styles.navMiddle} />
          <View style={styles.navRight} />
        </View>
      </View>

      {detailQuery.isPending ? (
        <View style={styles.center}>
          <ActivityIndicator color={ACCENT_COLOR} />
        </View>
      ) : detailQuery.isError || !detail ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>
            {detailQuery.error instanceof Error ? detailQuery.error.message : "活动信息加载失败"}
          </Text>
          <Pressable accessibilityRole="button" onPress={retry} style={styles.retryButton}>
            <Text style={styles.retryText}>重试</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.body}>
            {detail.rules ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="查看活动规则"
                style={styles.rulesPill}
                onPress={openRules}
              >
                <Text style={styles.rulesPillText}>活动规则</Text>
              </Pressable>
            ) : null}

            <View style={styles.hero}>
              <Text style={styles.mainTitle}>{detail.mainTitle || detail.displayTag}</Text>
              {detail.subTitle ? <Text style={styles.subTitle}>{detail.subTitle}</Text> : null}
            </View>

            <View style={styles.priceBlock}>
              <Text style={styles.priceLabel}>秒杀价</Text>
              <Text style={styles.priceValue}>
                {detail.product.activityPrice}
                <Text style={styles.priceUnit}> {priceUnit}</Text>
              </Text>
              <Text style={styles.originalPrice}>
                {detail.product.originalPrice}
                {priceUnit}
              </Text>
            </View>
          </View>

          <View style={[styles.footer, { paddingBottom: insets.bottom + FOOTER_CONTENT_BOTTOM }]}>
            <View style={styles.ctaWrap}>
              {showCountdown ? (
                <View style={styles.countdownPill}>
                  <Text style={styles.countdownText}>{countdownLabel}</Text>
                </View>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={buttonLabel}
                disabled={!joinable}
                onPress={handleJoin}
                style={({ pressed }) => [
                  styles.joinButton,
                  showCountdown ? styles.joinButtonWithCountdown : styles.joinButtonSolo,
                  !joinable && styles.joinDisabled,
                  pressed && joinable && styles.joinPressed,
                ]}
              >
                <Text style={styles.joinText}>{buttonLabel}</Text>
                <Text style={styles.joinSubText}>今日剩余名额：{detail.remainingStock}</Text>
              </Pressable>
            </View>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG_COLOR,
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
  navMiddle: {
    flex: 1,
  },
  navRight: {
    width: 56,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  errorText: {
    fontSize: 14,
    lineHeight: 20,
    color: "rgba(255,255,255,0.6)",
  },
  retryButton: {
    paddingHorizontal: 24,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  retryText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#FFFFFF",
  },
  body: {
    flex: 1,
    paddingHorizontal: 16,
  },
  rulesPill: {
    position: "absolute",
    top: 8,
    right: 0,
    zIndex: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  rulesPillText: {
    fontSize: 12,
    lineHeight: 18,
    color: "rgba(255,255,255,0.72)",
  },
  hero: {
    alignItems: "center",
    paddingTop: 72,
    gap: 12,
  },
  mainTitle: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "600",
    color: "#FFFFFF",
    textAlign: "center",
  },
  subTitle: {
    fontSize: 14,
    lineHeight: 20,
    color: "rgba(255,255,255,0.72)",
    textAlign: "center",
  },
  priceBlock: {
    marginTop: 40,
    alignItems: "center",
    gap: 8,
  },
  priceLabel: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: "500",
    color: "#FFFFFF",
  },
  priceValue: {
    fontSize: 40,
    lineHeight: 48,
    fontWeight: "700",
    color: ACCENT_COLOR,
  },
  priceUnit: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
    color: ACCENT_COLOR,
  },
  originalPrice: {
    fontSize: 18,
    lineHeight: 26,
    color: "rgba(255,255,255,0.35)",
    textDecorationLine: "line-through",
  },
  footer: {
    paddingTop: 8,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  ctaWrap: {
    width: 243,
    alignItems: "center",
  },
  countdownPill: {
    zIndex: 1,
    marginBottom: -COUNTDOWN_OVERLAP,
    paddingHorizontal: 16,
    height: 34,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  countdownText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#0D0D0F",
  },
  joinButton: {
    width: "100%",
    minHeight: 80,
    borderRadius: 12,
    paddingBottom: 12,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ACCENT_COLOR,
    gap: 4,
  },
  joinButtonWithCountdown: {
    paddingTop: COUNTDOWN_OVERLAP + 8,
  },
  joinButtonSolo: {
    paddingTop: 12,
  },
  joinDisabled: {
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  joinPressed: {
    opacity: 0.85,
  },
  joinText: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "600",
    color: "#FFFFFF",
    textAlign: "center",
  },
  joinSubText: {
    fontSize: 13,
    lineHeight: 18,
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
  },
});
