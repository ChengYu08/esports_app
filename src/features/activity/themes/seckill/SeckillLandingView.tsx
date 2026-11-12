import { Image } from "expo-image";
import { router, type Href } from "expo-router";
import { useCallback, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { setPendingActivityRules } from "@/features/activity/activity-rules-transfer";
import { computeActivityStatus } from "@/features/activity/activity-status";
import {
  formatCountdown,
  useActivityCountdown,
} from "@/features/activity/hooks/use-activity-detail";
import type { ActivityThemeProps } from "@/features/activity/themes/types";

import { ACTIVITY_SECKILL_ASSETS } from "./assets";
import { useSeckillJoin } from "./use-seckill-join";

const FOOTER_CONTENT_BOTTOM = 28;
const COUNTDOWN_OVERLAP = 18;

/** 秒杀活动 Theme：UI + 状态机 + 倒计时 + 进试音房交互。 */
export default function SeckillLandingView({ detail, insets, headerOffset }: ActivityThemeProps) {
  const { nowMs, offsetMs } = useActivityCountdown(detail.serverTime);

  const computed = useMemo(
    () =>
      computeActivityStatus(
        {
          startTime: detail.startTime,
          endTime: detail.endTime,
          remainingStock: detail.remainingStock,
          buttonStatus: detail.buttonStatus,
          disabledReason: detail.disabledReason,
        },
        nowMs,
        offsetMs,
      ),
    [detail, nowMs, offsetMs],
  );

  // 倒计时：进行中显示距结束剩余，未开始显示距开抢剩余。
  const countdownMs = useMemo(() => {
    const serverNow = nowMs + offsetMs;
    if (computed.status === "NOT_STARTED") {
      const startMs = Date.parse(detail.startTime);
      return Number.isFinite(startMs) ? startMs - serverNow : 0;
    }
    const endMs = Date.parse(detail.endTime);
    return Number.isFinite(endMs) ? endMs - serverNow : 0;
  }, [computed.status, detail.endTime, detail.startTime, nowMs, offsetMs]);

  const { joinable, handleJoin } = useSeckillJoin(detail, computed);

  const openRules = useCallback(() => {
    if (!detail.rules) {
      return;
    }
    setPendingActivityRules(detail.rules);
    // typedRoutes 生成滞后时 /activity/rules 可能尚未入库，运行时路由文件已存在
    router.push("/activity/rules" as Href);
  }, [detail.rules]);

  const showCountdown = computed.status === "ACTIVE" || computed.status === "NOT_STARTED";
  const countdownLabel =
    computed.status === "NOT_STARTED"
      ? `距开抢：${formatCountdown(countdownMs)}`
      : `活动倒计时：${formatCountdown(countdownMs)}`;

  return (
    <View style={styles.root}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Image
          source={{ uri: ACTIVITY_SECKILL_ASSETS.bg }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
      </View>

      {/* 与 Shell 绝对定位导航对齐，避免内容顶到状态栏下。 */}
      <View style={{ height: headerOffset }} />

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
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
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
    width: (550 / 3) * 0.8,
    height: (160 / 3) * 0.8,
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
    transform: [{ translateX: 4 }, { translateY: -1 }],
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
