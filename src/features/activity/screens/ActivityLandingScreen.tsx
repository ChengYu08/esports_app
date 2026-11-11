import { ChevronLeft24Regular } from "@fluentui/react-native-icons";
import { useAuthStore } from "@esports/auth";
import { Image } from "expo-image";
import { Stack, router, type Href } from "expo-router";
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
import { fetchActiveQuickMatch } from "@/features/match/api/match.api";
import {
  isQuickMatchActive,
  type QuickMatchRequestDetail,
} from "@/features/match/api/match.types";
import { openAuditionRoom } from "@/features/match/enter-audition-room";
import { isExistingDispatchConflictMessage } from "@/features/match/existing-dispatch-hint";
import {
  ensureRealNameBeforeVoiceRoomEnter,
  promptSelfRealNameIfNeeded,
} from "@/features/voice-room/ensure-real-name-before-enter";
import { requireLogin } from "@/shared/navigation/require-login";
import { showToast } from "@/shared/ui/app-toast";

const BG_COLOR = "#0C0C2E";
const LOADING_COLOR = "#4D8BFF";
const OSS_BASE = "https://djoss.panzhi.com/dj-oss-upload/moblie";
const ACTIVITY_SECKILL_ASSETS = {
  bg: `${OSS_BASE}/bg_activity_seckill.webp`,
  rules: `${OSS_BASE}/activity_seckill_rules.png`,
  title: `${OSS_BASE}/activity_seckill_title.png`,
  price: `${OSS_BASE}/activity_seckill_price.png`,
  btnBg: `${OSS_BASE}/activity_seckill_btn_bg.png`,
  countdownBg: `${OSS_BASE}/activity_seckill_countdown_bg2.png`,
  btnText: `${OSS_BASE}/activity_seckill_btn_text.png`,
} as const;

const FOOTER_CONTENT_BOTTOM = 28;
const COUNTDOWN_OVERLAP = 18;

/** 恢复进匹配中页（对齐 useRestoreActiveMatch 参数） */
function goMatchingFromActive(active: QuickMatchRequestDetail) {
  router.replace({
    pathname: "/match/matching/[requestNo]",
    params: {
      requestNo: active.requestNo,
      ...(active.expireTime ? { expireTime: active.expireTime } : {}),
      ...(active.gameId && active.gameName
        ? {
            gameId: String(active.gameId),
            gameName: active.gameName,
          }
        : {}),
    },
  });
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
    // typedRoutes 生成滞后时 /activity/rules 可能尚未入库，运行时路由文件已存在
    router.push("/activity/rules" as Href);
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
    if (!(await ensureRealNameBeforeVoiceRoomEnter())) {
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
      const message = error instanceof Error ? error.message : "参与活动失败，请重试";
      if (await promptSelfRealNameIfNeeded(message)) {
        return;
      }
      // 已有未过期派单：查 active → ensure 进试音房；进房失败再回退匹配中页。
      if (isExistingDispatchConflictMessage(message)) {
        try {
          const active = await fetchActiveQuickMatch(token);
          if (active && isQuickMatchActive(active)) {
            if (active.needVoice === false) {
              goMatchingFromActive(active);
              return;
            }
            const entered = await openAuditionRoom(active.requestNo, token, {
              expireTime: active.expireTime || undefined,
            });
            if (!entered) {
              goMatchingFromActive(active);
            }
            return;
          }
        } catch {
          // 恢复查询失败则落回原错误文案
        }
      }
      showToast(message);
    } finally {
      setPublishing(false);
    }
  }, [computed, detail, publishing, token]);

  const joinable = computed?.status === "ACTIVE" && !publishing;
  const showCountdown = computed?.status === "ACTIVE" || computed?.status === "NOT_STARTED";
  const countdownLabel =
    computed?.status === "NOT_STARTED"
      ? `距开抢：${formatCountdown(countdownMs)}`
      : `活动倒计时：${formatCountdown(countdownMs)}`;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <Stack.Screen options={{ headerShown: false }} />
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Image
          source={{ uri: ACTIVITY_SECKILL_ASSETS.bg }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
      </View>
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
          <ActivityIndicator color={LOADING_COLOR} />
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
                style={styles.rulesButton}
                onPress={openRules}
              >
                <Image
                  source={{ uri: ACTIVITY_SECKILL_ASSETS.rules }}
                  style={styles.rulesImage}
                  contentFit="contain"
                />
              </Pressable>
            ) : null}

            <View style={styles.hero}>
              <Image
                source={{ uri: ACTIVITY_SECKILL_ASSETS.title }}
                style={styles.titleImage}
                contentFit="contain"
              />
            </View>

            <View style={styles.priceBlock}>
              <Image
                source={{ uri: ACTIVITY_SECKILL_ASSETS.price }}
                style={styles.priceImage}
                contentFit="contain"
              />
            </View>
          </View>

          <View style={[styles.footer, { paddingBottom: insets.bottom + FOOTER_CONTENT_BOTTOM }]}>
            <View style={styles.ctaWrap}>
              {showCountdown ? (
                <View style={styles.countdownWrap}>
                  <Image
                    source={{ uri: ACTIVITY_SECKILL_ASSETS.countdownBg }}
                    style={styles.countdownBg}
                    contentFit="fill"
                  />
                  <Text style={styles.countdownText}>{countdownLabel}</Text>
                </View>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="立即参与"
                disabled={!joinable}
                onPress={handleJoin}
                style={({ pressed }) => [
                  styles.joinButton,
                  !joinable && styles.joinDisabled,
                  pressed && joinable && styles.joinPressed,
                ]}
              >
                <Image
                  source={{ uri: ACTIVITY_SECKILL_ASSETS.btnBg }}
                  style={styles.joinBg}
                  contentFit="fill"
                />
                <View style={styles.joinContent}>
                  <Image
                    source={{ uri: ACTIVITY_SECKILL_ASSETS.btnText }}
                    style={styles.joinTextImage}
                    contentFit="contain"
                  />
                  <Text style={styles.joinSubText}>
                    今日剩余名额：
                    <Text style={styles.joinSubTextStrong}>{detail.remainingStock}</Text>
                  </Text>
                </View>
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
    zIndex: 2,
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
  },
  rulesButton: {
    position: "absolute",
    top: 4,
    right: 0,
    zIndex: 1,
  },
  rulesImage: {
    width: 72,
    height: 23,
  },
  hero: {
    alignItems: "center",
    paddingTop: 80,
    paddingHorizontal: 16,
  },
  titleImage: {
    width: "100%",
    aspectRatio: 1348 / 450,
  },
  priceBlock: {
    marginTop: 60,
    alignItems: "center",
  },
  priceImage: {
    width: 180,
    aspectRatio: 675 / 487,
  },
  footer: {
    paddingTop: 8,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  ctaWrap: {
    width: 252,
    alignItems: "center",
    transform: [{ translateY: -120 }],
  },
  countdownWrap: {
    zIndex: 1,
    marginBottom: -COUNTDOWN_OVERLAP,
    // 资源 550×160 @3x，再缩放到 75%
    width: (550 / 3) * 0.80,
    height: (160 / 3) * 0.80,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ translateX: 75 }, { translateY: -5 }],
  },
  countdownBg: {
    ...StyleSheet.absoluteFill,
  },
  countdownText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "600",
    color: "#000000",
    transform: [{ translateX: 4 },{ translateY: -1 }],
  },
  joinButton: {
    width: "100%",
    aspectRatio: 914 / 261,
    alignItems: "center",
    justifyContent: "center",
  },
  joinBg: {
    ...StyleSheet.absoluteFill,
  },
  joinContent: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingTop: 4,
  },
  joinTextImage: {
    width: 108,
    height: 22,
  },
  joinDisabled: {
    opacity: 0.45,
  },
  joinPressed: {
    opacity: 0.85,
  },
  joinSubText: {
    fontSize: 12,
    lineHeight: 16,
    color: "rgba(255,255,255,0.9)",
    textAlign: "center",
  },
  joinSubTextStrong: {
    fontWeight: "700",
  },
});
