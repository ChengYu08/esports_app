import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, type ReactNode } from "react";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { showToast } from "@/shared/ui/app-toast";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  useSmsNotifyStatus,
  useUpdateSmsNotify,
} from "@/features/mine/hooks/use-sms-notify";

const backIcon = require("../../../../assets/home/club-detail/icon-back.svg");

const SWITCH_WIDTH = 40;
const SWITCH_HEIGHT = 22;
const SWITCH_KNOB_SIZE = 18;
const SWITCH_PADDING = 2;
const SWITCH_KNOB_TRAVEL =
  SWITCH_WIDTH - SWITCH_KNOB_SIZE - SWITCH_PADDING * 2;

function MessageNotificationScreenImpl() {
  const insets = useSafeAreaInsets();
  // 状态通常已由基础设置页预热进缓存，此处命中后直接渲染，不再出现加载刷新
  const { data, isSuccess, isError, error } = useSmsNotifyStatus();
  const updateSmsNotify = useUpdateSmsNotify();
  const smsEnabled = data === 1;

  useEffect(() => {
    if (isError) {
      showToast(
        error instanceof Error
          ? error.message
          : "短信通知设置加载失败，请刷新重试",
      );
    }
  }, [isError, error]);

  const toggleSmsNotify = (next: boolean) => {
    if (!isSuccess || updateSmsNotify.isPending) {
      return;
    }
    updateSmsNotify.mutate(next, {
      onError: (mutationError) => {
        showToast(
          mutationError instanceof Error
            ? mutationError.message
            : "短信通知设置保存失败，请重试",
        );
      },
    });
  };

  return (
    <View style={styles.screen}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top, height: insets.top + 44 },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="返回"
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Image source={backIcon} style={styles.backIcon} />
        </Pressable>
        <Text style={styles.headerTitle}>消息通知</Text>
        <View style={styles.headerEnd} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.settingsGroup}>
          <NotificationRow
            title="短信通知"
            subtitle="开启后，平台重要通知会通过短信推送"
            divider={false}
          >
            <NotificationSwitch
              value={smsEnabled}
              disabled={!isSuccess || updateSmsNotify.isPending}
              onToggle={toggleSmsNotify}
            />
          </NotificationRow>
        </View>
      </ScrollView>
    </View>
  );
}

function NotificationRow({
  title,
  subtitle,
  divider = true,
  children,
}: {
  title: string;
  subtitle: string;
  divider?: boolean;
  children: ReactNode;
}) {
  return (
    <View>
      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text style={styles.rowTitle}>{title}</Text>
          <Text style={styles.rowSubtitle}>{subtitle}</Text>
        </View>
        {children}
      </View>
      {divider ? <View style={styles.rowDivider} /> : null}
    </View>
  );
}

function NotificationSwitch({
  value,
  disabled,
  onToggle,
}: {
  value: boolean;
  disabled?: boolean;
  onToggle: (next: boolean) => void;
}) {
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(value ? 1 : 0, { duration: 160 });
  }, [progress, value]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [
      "#CCCCCC",
      "#36C277",
    ]),
  }));
  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * SWITCH_KNOB_TRAVEL }],
  }));

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled: Boolean(disabled) }}
      disabled={disabled}
      hitSlop={10}
      onPress={() => onToggle(!value)}
      style={styles.switch}
    >
      <Animated.View style={[styles.switchTrack, trackStyle]}>
        <Animated.View style={[styles.switchKnob, knobStyle]} />
      </Animated.View>
    </Pressable>
  );
}

export default MessageNotificationScreenImpl;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F7F7" },
  header: {
    backgroundColor: "#FFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    width: 48,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  backIcon: { width: 24, height: 24, tintColor: "#0A0A0A" },
  headerTitle: {
    color: "#0A0A0A",
    fontWeight: "500",
    fontSize: 16,
    lineHeight: 24,
  },
  headerEnd: { width: 16 },
  settingsGroup: { marginTop: 8, backgroundColor: "#FFF" },
  row: {
    paddingLeft: 16,
    paddingRight: 12,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowText: { gap: 4, marginRight: 12, flexShrink: 1 },
  rowTitle: {
    color: "#333333",
    fontSize: 14,
    lineHeight: 22,
  },
  rowSubtitle: {
    color: "#999999",
    fontSize: 12,
    lineHeight: 18,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#EBEBEB",
    marginLeft: 16,
  },
  switch: {
    width: SWITCH_WIDTH,
    height: SWITCH_HEIGHT,
    borderRadius: SWITCH_HEIGHT / 2,
  },
  switchTrack: {
    width: SWITCH_WIDTH,
    height: SWITCH_HEIGHT,
    borderRadius: SWITCH_HEIGHT / 2,
    padding: SWITCH_PADDING,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  switchKnob: {
    width: SWITCH_KNOB_SIZE,
    height: SWITCH_KNOB_SIZE,
    borderRadius: SWITCH_KNOB_SIZE / 2,
    backgroundColor: "#FFFFFF",
  },
});
