import { DOUYIN_SANS } from "@/shared/theme/typography";
import { useAuthStore } from "@esports/auth";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { formatUnreadCount, sumVisibleUnreadCount } from "@/features/message/message-unread";
import { useMessageStore } from "@/features/message/message-store";
import {
  getProtectedNavigationAction,
  getTabPressAction,
  type AppTab,
} from "@/shared/navigation/tab-access";

type AppTabBarProps = {
  state: { index: number; routes: { name: string }[] };
  navigation: { navigate: (name: string) => void };
};

const TAB_CONTENT_HEIGHT = 58;
const TAB_ITEM_HEIGHT = 46;
const MATCH_WIDTH = 68;
const MATCH_HEIGHT = 58;
const BAR_TOP_OFFSET = 12;

const items = [
  {
    route: "index",
    label: "首页",
    icon: require("../../../assets/coms/tab-home.svg"),
    selectedIcon: require("../../../assets/coms/tab-home-selected.svg"),
  },
  {
    route: "order",
    label: "订单",
    icon: require("../../../assets/coms/tab-order.svg"),
    selectedIcon: require("../../../assets/coms/tab-order-selected.svg"),
  },
  {
    route: "message",
    label: "消息",
    icon: require("../../../assets/coms/tab-message.svg"),
    selectedIcon: require("../../../assets/coms/tab-message-selected.svg"),
  },
  {
    route: "mine",
    label: "我的",
    icon: require("../../../assets/coms/tab-mine.svg"),
    selectedIcon: require("../../../assets/coms/tab-mine-selected.svg"),
  },
] as const;

const matchIcon = require("../../../assets/coms/tab-match.svg");

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

  const handleTabPress = (tab: AppTab) => {
    const action = getTabPressAction(tab, isAuthenticated);
    if (action.type === "login") {
      router.replace("/login");
      return;
    }
    navigation.navigate(action.tab);
  };

  const handleMatchPress = () => {
    const action = getProtectedNavigationAction("match", isAuthenticated);
    if (action.type === "login") {
      router.replace("/login");
      return;
    }
    router.push("/match");
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
        {renderTabItem(items[0])}
        {renderTabItem(items[1])}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="快速匹配"
          style={styles.matchButton}
          onPress={handleMatchPress}
        >
          <Image source={matchIcon} style={styles.matchIcon} />
        </Pressable>
        {renderTabItem(items[2])}
        {renderTabItem(items[3])}
      </View>
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
  matchButton: {
    width: MATCH_WIDTH,
    height: MATCH_HEIGHT,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  matchIcon: {
    width: MATCH_WIDTH,
    height: MATCH_HEIGHT,
  },
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
    fontFamily: DOUYIN_SANS,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "400",
  },
  bottomLabel: {
    fontFamily: DOUYIN_SANS,
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
