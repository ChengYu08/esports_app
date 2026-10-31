import { ChevronLeft24Regular } from "@fluentui/react-native-icons";
import { useAuthStore } from "@esports/auth";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ApiError } from "@/core/network/api-client";
import { computeActivityStatus } from "@/features/activity-seckill/activity-status";
import { publishActivity } from "@/features/activity-seckill/api/activity.api";
import { ActivityRulesModal } from "@/features/activity-seckill/components/ActivityRulesModal";
import {
  formatCountdown,
  useActivityCountdown,
  useActivityDetail,
} from "@/features/activity-seckill/hooks/use-activity-detail";
import { openAuditionRoom } from "@/features/match/enter-audition-room";
import { requireLogin } from "@/shared/navigation/require-login";
import { showToast } from "@/shared/ui/app-toast";

const BG_COLOR = "#0C0C2E";
const ACCENT_COLOR = "#FE4267";
const FOOTER_CONTENT_BOTTOM = 22;

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

export default function SeckillLandingScreen({ activityCode }: { activityCode: string }) {
  const insets = useSafeAreaInsets();
  const token = useAuthStore((state) => state.accessToken);
  const detailQuery = useActivityDetail(activityCode);
  const detail = detailQuery.data ?? null;

  const { nowMs, offsetMs } = useActivityCountdown(detail?.serverTime);

  const [publishing, setPublishing] = useState(false);
  const [rulesVisible, setRulesVisible] = useState(false);

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
          <Text style={styles.navTitle}>{detail?.displayTag || "活动"}</Text>
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
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.mainTitle}>{detail.mainTitle || detail.displayTag}</Text>
            {detail.subTitle ? <Text style={styles.subTitle}>{detail.subTitle}</Text> : null}

            <View style={styles.priceCard}>
              <View style={styles.priceRow}>
                <Text style={styles.priceValue}>{detail.product.activityPrice}</Text>
                <Text style={styles.priceUnit}>钻石{detail.product.billingUnitName ? `/${detail.product.billingUnitName}` : ""}</Text>
              </View>
              <Text style={styles.originalPrice}>{detail.product.originalPrice}钻石</Text>
            </View>

            {showCountdown ? (
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>
                  {computed?.status === "NOT_STARTED" ? "距开始" : "距结束"}
                </Text>
                <Text style={styles.statValue}>{formatCountdown(countdownMs)}</Text>
              </View>
            ) : null}
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>剩余名额</Text>
              <Text style={styles.statValue}>{detail.remainingStock}个</Text>
            </View>

            {detail.rules ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="查看活动规则"
                style={styles.rulesEntry}
                onPress={() => {
                  setRulesVisible(true);
                }}
              >
                <Text style={styles.rulesEntryText}>活动规则</Text>
                <ChevronLeft24Regular
                  color="rgba(255,255,255,0.4)"
                  width={16}
                  height={16}
                  style={styles.rulesArrow}
                />
              </Pressable>
            ) : null}
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: insets.bottom + FOOTER_CONTENT_BOTTOM }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={buttonLabel}
              disabled={!joinable}
              onPress={handleJoin}
              style={({ pressed }) => [
                styles.joinButton,
                !joinable && styles.joinDisabled,
                pressed && joinable && styles.joinPressed,
              ]}
            >
              <Text style={styles.joinText}>{buttonLabel}</Text>
            </Pressable>
          </View>
        </>
      )}

      {detail ? (
        <ActivityRulesModal
          visible={rulesVisible}
          rules={detail.rules}
          onClose={() => {
            setRulesVisible(false);
          }}
        />
      ) : null}
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
  navTitle: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
    color: "#FFFFFF",
    textAlign: "center",
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 16,
  },
  mainTitle: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  subTitle: {
    fontSize: 14,
    lineHeight: 20,
    color: "rgba(255,255,255,0.6)",
  },
  priceCard: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
  },
  priceValue: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "700",
    color: ACCENT_COLOR,
  },
  priceUnit: {
    fontSize: 13,
    lineHeight: 18,
    color: ACCENT_COLOR,
    paddingBottom: 4,
  },
  originalPrice: {
    fontSize: 14,
    lineHeight: 20,
    color: "rgba(255,255,255,0.4)",
    textDecorationLine: "line-through",
    paddingBottom: 4,
  },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statLabel: {
    fontSize: 14,
    lineHeight: 20,
    color: "rgba(255,255,255,0.6)",
  },
  statValue: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  rulesEntry: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  rulesEntryText: {
    fontSize: 14,
    lineHeight: 20,
    color: "rgba(255,255,255,0.8)",
  },
  rulesArrow: {
    transform: [{ rotate: "180deg" }],
  },
  footer: {
    paddingTop: 8,
    paddingHorizontal: 16,
  },
  joinButton: {
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ACCENT_COLOR,
  },
  joinDisabled: {
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  joinPressed: {
    opacity: 0.85,
  },
  joinText: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
