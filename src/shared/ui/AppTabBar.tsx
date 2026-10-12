import { DOUYIN_SANS } from "@/shared/theme/typography";
import { useAuthStore } from "@esports/auth";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  getTabPressAction,
  type AppTab,
} from "@/shared/navigation/tab-access";

type AppTabBarProps = {
  state: { index: number; routes: { name: string }[] };
  navigation: { navigate: (name: string) => void };
};

const items = [
  {
    route: "index",
    label: "首页",
    icon: require("../../../assets/coms/tab-home.svg"),
    selectedIcon: require("../../../assets/coms/tab-home-selected.svg"),
  },
  {
    route: "ranking",
    label: "排行榜",
    icon: require("../../../assets/coms/tab-ranking.svg"),
    selectedIcon: require("../../../assets/coms/tab-ranking-selected.svg"),
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

export function AppTabBar({ state, navigation }: AppTabBarProps) {
  const insets = useSafeAreaInsets();
  const isAuthenticated = useAuthStore((authState) =>
    Boolean(authState.accessToken && authState.user),
  );
  const activeRoute = state.routes[state.index]?.name;

  const handleTabPress = (tab: AppTab) => {
    const action = getTabPressAction(tab, isAuthenticated);
    if (action.type === "login") {
      router.replace("/login");
      return;
    }
    navigation.navigate(action.tab);
  };

  return (
    <View
      style={[
        styles.bottom,
        { height: 60 + insets.bottom, paddingBottom: insets.bottom },
      ]}
    >
      {items.map((item) => {
        const selected = activeRoute === item.route;

        return (
          <Pressable
            key={item.route}
            accessibilityRole="tab"
            accessibilityLabel={item.label}
            accessibilityState={{ selected }}
            style={styles.bottomItem}
            onPress={() => handleTabPress(item.route)}
          >
            <Image
              source={selected ? item.selectedIcon : item.icon}
              style={styles.bottomIcon}
            />
            <Text style={[styles.bottomLabel, selected && styles.bottomActive]}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
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
    minHeight: 60,
    backgroundColor: "#fff",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#EBEBEB",
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-around",
    paddingTop: 1,
  },
  bottomItem: {
    flex: 1,
    height: 48,
    alignItems: "center",
    paddingTop: 1,
    gap: 1,
  },
  bottomIcon: { width: 30, height: 30 },
  bottomLabel: { fontFamily: DOUYIN_SANS, color: "#c8c8cc", fontSize: 11 },
  bottomActive: { fontFamily: DOUYIN_SANS, color: "#333" },
});
