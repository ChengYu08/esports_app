import { ChevronLeft24Regular } from "@fluentui/react-native-icons";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useActivityDetail } from "@/features/activity/hooks/use-activity-detail";
import type { ActivityThemeComponent } from "@/features/activity/themes/types";

const BG_COLOR = "#0C0C2E";
const LOADING_COLOR = "#4D8BFF";
const NAV_BAR_HEIGHT = 44;

type ActivityShellProps = {
  activityCode: string;
  /** 已解析的 Theme；null 表示未注册活动 */
  Theme: ActivityThemeComponent | null;
};

/**
 * 活动落地页极简壳：导航 / loading / error / 拉详情；
 * 状态机、倒计时、交互由 Theme 内聚。
 */
export default function ActivityShell({ activityCode, Theme }: ActivityShellProps) {
  const insets = useSafeAreaInsets();
  // 未注册 Theme 不拉详情，避免无效请求。
  const detailQuery = useActivityDetail(Theme ? activityCode : "");
  const detail = detailQuery.data ?? null;

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

  const showUnsupported = !Theme;
  const showLoading = Boolean(Theme) && detailQuery.isPending;
  const showError = Boolean(Theme) && (detailQuery.isError || (!detailQuery.isPending && !detail));
  const showTheme = Boolean(Theme) && Boolean(detail);
  // 导航绝对定位叠在全屏 Theme 之上，避免占文档流导致背景从导航下方才开始铺。
  const headerOffset = insets.top + NAV_BAR_HEIGHT;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <Stack.Screen options={{ headerShown: false }} />

      {showUnsupported ? (
        <View style={[styles.center, { paddingTop: headerOffset }]}>
          <Text style={styles.errorText}>{`暂不支持活动 ${activityCode}`}</Text>
          <Pressable accessibilityRole="button" onPress={goBack} style={styles.retryButton}>
            <Text style={styles.retryText}>返回</Text>
          </Pressable>
        </View>
      ) : null}

      {showLoading ? (
        <View style={[styles.center, { paddingTop: headerOffset }]}>
          <ActivityIndicator color={LOADING_COLOR} />
        </View>
      ) : null}

      {showError ? (
        <View style={[styles.center, { paddingTop: headerOffset }]}>
          <Text style={styles.errorText}>
            {detailQuery.error instanceof Error ? detailQuery.error.message : "活动信息加载失败"}
          </Text>
          <Pressable accessibilityRole="button" onPress={retry} style={styles.retryButton}>
            <Text style={styles.retryText}>重试</Text>
          </Pressable>
        </View>
      ) : null}

      {showTheme && Theme && detail ? (
        <Theme detail={detail} insets={insets} headerOffset={headerOffset} />
      ) : null}

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
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG_COLOR,
  },
  nav: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
  },
  navBar: {
    height: NAV_BAR_HEIGHT,
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
});
