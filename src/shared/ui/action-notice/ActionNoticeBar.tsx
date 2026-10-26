import { Image, type ImageSource } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DOUYIN_SANS } from "@/shared/theme/typography";

const ARROW_ICON = require("../../../../assets/svgs/cs-invite-arrow-right.svg");

const TAB_BAR_HEIGHT = 58;
const MIN_DURATION_MS = 2000;

type ActionNoticeBarProps = {
  text: string;
  actionText: string;
  icon: ImageSource | number;
  claiming?: boolean;
  onPressAction: () => void;
  /** Unix ms 到期时刻；到期自动消失 */
  expireAt: number;
  maxDurationMs: number;
  minDurationMs?: number;
  /** 到期自动消失时调用（清队列条目） */
  onDismiss: () => void;
  /** 与其它条叠加时的额外底部偏移（由 Host 计算） */
  extraBottomOffset?: number;
};

export function ActionNoticeBar({
  text,
  actionText,
  icon,
  claiming,
  onPressAction,
  expireAt,
  maxDurationMs,
  minDurationMs = MIN_DURATION_MS,
  onDismiss,
  extraBottomOffset = 0,
}: ActionNoticeBarProps) {
  const insets = useSafeAreaInsets();
  const onDismissRef = useRef(onDismiss);

  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  // 到期或达到上限时长后消失；最少展示 minDuration，防止刚弹出就被过期数据收走。
  // 计时不随页面切换暂停。onDisappear 由 store dismiss/挤旧/clear 统一触发。
  useEffect(() => {
    const remainMs = expireAt - Date.now();
    const duration = Math.min(Math.max(remainMs, minDurationMs), maxDurationMs);
    const timer = setTimeout(() => onDismissRef.current(), duration);
    return () => {
      clearTimeout(timer);
    };
  }, [expireAt, maxDurationMs, minDurationMs]);

  return (
    <Animated.View
      entering={FadeInDown.duration(250)}
      exiting={FadeOutUp.duration(200)}
      pointerEvents="box-none"
      style={[
        styles.overlay,
        { bottom: insets.bottom + TAB_BAR_HEIGHT + 12 + extraBottomOffset },
      ]}
    >
      <View style={styles.shadow}>
        <LinearGradient
          colors={["#2F2759", "#231E4B", "#0C0C2E"]}
          end={{ x: 0.996, y: 0.565 }}
          locations={[0.004, 0.805, 1]}
          start={{ x: 0.004, y: 0.435 }}
          style={styles.bar}
        >
          <View style={styles.info}>
            <Image contentFit="contain" source={icon} style={styles.icon} />
            <Text numberOfLines={1} style={styles.text}>
              {text}
            </Text>
          </View>
          <Pressable
            accessibilityLabel={actionText}
            accessibilityRole="button"
            disabled={claiming}
            hitSlop={8}
            onPress={onPressAction}
            style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
          >
            <Text style={styles.actionText}>{actionText}</Text>
            <Image contentFit="contain" source={ARROW_ICON} style={styles.icon} />
          </Pressable>
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
    zIndex: 1000,
    elevation: 1000,
  },
  shadow: {
    borderRadius: 43,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 4,
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 43,
    overflow: "hidden",
  },
  info: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  icon: {
    width: 16,
    height: 16,
    flexShrink: 0,
  },
  text: {
    flex: 1,
    minWidth: 0,
    color: "#FFFFFF",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    fontWeight: "400",
    lineHeight: 18,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    flexShrink: 0,
  },
  actionPressed: { opacity: 0.78 },
  actionText: {
    color: "#FFFFFF",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    fontWeight: "400",
    lineHeight: 18,
  },
});
