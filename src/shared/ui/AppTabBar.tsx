import { useAuthStore } from "@esports/auth";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { formatUnreadCount, sumVisibleUnreadCount } from "@/features/message/message-unread";
import { useMessageStore } from "@/features/message/message-store";
import { layout } from "@/shared/theme/tokens";
import { AppPrompt } from "@/shared/ui/AppPrompt";
import {
  getTabPressAction,
  type AppTab,
} from "@/shared/navigation/tab-access";

type AppTabBarProps = {
  state: { index: number; routes: { name: string }[] };
  navigation: { navigate: (name: string) => void };
};

const TAB_CONTENT_HEIGHT = layout.tabBarHeight;
const TAB_ITEM_HEIGHT = 46;
const BAR_TOP_OFFSET = 12;
// 隐藏诊断入口：3 秒内连点消息 tab 5 次，弹窗展示本次启动的回补消息条数
const DIAGNOSTIC_TAP_THRESHOLD = 5;
const DIAGNOSTIC_TAP_WINDOW_MS = 3_000;

// react-hooks/purity 禁止在组件里直接调用 Date.now，时间获取封装在模块级
function nowMs() {
  return Date.now();
}

const items = [
  {
    route: "index",
    label: "首页",
    icon: require("../../../assets/svgs/tab-home.svg"),
    selectedIcon: require("../../../assets/svgs/tab-home-selected.svg"),
  },
  {
    route: "order",
    label: "订单",
    icon: require("../../../assets/svgs/tab-order.svg"),
    selectedIcon: require("../../../assets/svgs/tab-order-selected.svg"),
  },
  {
    route: "message",
    label: "消息",
    icon: require("../../../assets/svgs/tab-message.svg"),
    selectedIcon: require("../../../assets/svgs/tab-message-selected.svg"),
  },
  {
    route: "mine",
    label: "我的",
    icon: require("../../../assets/svgs/tab-mine.svg"),
    selectedIcon: require("../../../assets/svgs/tab-mine-selected.svg"),
  },
] as const;

export function AppTabBar({ state, navigation }: AppTabBarProps) {
  const insets = useSafeAreaInsets();
  const isAuthenticated = useAuthStore((authState) =>
    Boolean(authState.accessToken && authState.user),
  );
  const userId = useAuthStore((authState) => authState.user?.id);
  const unreadCount = useMessageStore((messageState) =>
    sumVisibleUnreadCount(messageState.conversations, userId, messageState.blacklistedUserIds),
  );
  const unreadLabel = formatUnreadCount(unreadCount);
  const activeRoute = state.routes[state.index]?.name;
  const compensatedCount = useMessageStore((messageState) => messageState.compensatedCount);
  const [diagnosticVisible, setDiagnosticVisible] = useState(false);
  const [diagnosticTaps, setDiagnosticTaps] = useState({ count: 0, windowStartAt: 0 });

  const handleTabPress = (tab: AppTab) => {
    if (tab === "message") {
      const tapAt = nowMs();
      const withinWindow = tapAt - diagnosticTaps.windowStartAt <= DIAGNOSTIC_TAP_WINDOW_MS;
      const count = withinWindow ? diagnosticTaps.count + 1 : 1;
      if (count >= DIAGNOSTIC_TAP_THRESHOLD) {
        setDiagnosticTaps({ count: 0, windowStartAt: 0 });
        setDiagnosticVisible(true);
      } else {
        setDiagnosticTaps({ count, windowStartAt: withinWindow ? diagnosticTaps.windowStartAt : tapAt });
      }
    } else {
      setDiagnosticTaps({ count: 0, windowStartAt: 0 });
    }
    const action = getTabPressAction(tab, isAuthenticated);
    if (action.type === "login") {
      router.replace("/login");
      return;
    }
    navigation.navigate(action.tab);
  };

  const renderTabItem = (item: (typeof items)[number]) => {
    const selected = activeRoute === item.route;

    return (
      <Pressable
        key={item.route}
        accessibilityRole="tab"
        accessibilityLabel={
          item.route === "message" && unreadLabel
            ? `${item.label}，${unreadLabel}条未读`
            : item.label
        }
        accessibilityState={{ selected }}
        style={styles.tabSlot}
        onPress={() => handleTabPress(item.route)}
      >
        <View style={styles.bottomItem}>
          <View style={styles.iconContainer}>
            <Image
              source={selected ? item.selectedIcon : item.icon}
              style={styles.bottomIcon}
            />
            {item.route === "message" && unreadLabel ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadLabel}</Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.bottomLabel, selected && styles.bottomActive]}>
            {item.label}
          </Text>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[styles.bottom, { height: TAB_CONTENT_HEIGHT + insets.bottom }]}>
      <View
        style={[
          styles.barFill,
          {
            bottom: 0,
            height: TAB_CONTENT_HEIGHT - BAR_TOP_OFFSET + insets.bottom,
          },
        ]}
      />
      <View style={styles.iconArea}>
        {items.map((item) => renderTabItem(item))}
      </View>
      <AppPrompt
        visible={diagnosticVisible}
        title="消息统计"
        message={`本次启动回补消息：${compensatedCount} 条`}
        onConfirm={() => setDiagnosticVisible(false)}
      />
    </View>
  );
}

export const HomeBottomNav = AppTabBar;

const styles = StyleSheet.create({
  bottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "transparent",
  },
  barFill: {
    position: "absolute",
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#F5F5F5",
  },
  iconArea: {
    height: TAB_CONTENT_HEIGHT,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
  },
  tabSlot: {
    flex: 1,
    height: TAB_ITEM_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  bottomItem: {
    width: 46,
    height: TAB_ITEM_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  iconContainer: {
    width: 24,
    height: 24,
    position: "relative",
  },
  bottomIcon: { width: 24, height: 24 },
  badge: {
    position: "absolute",
    top: 1,
    left: 16,
    minWidth: 16,
    minHeight: 16,
    paddingHorizontal: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FE4267",
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "400",
  },
  bottomLabel: {
    color: "#979799",
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "400",
    textAlign: "center",
  },
  bottomActive: {
    color: "#0D0D0F",
    fontWeight: "600",
  },
});
