import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DOUYIN_SANS } from "@/shared/theme/typography";

type AppTabBarProps = {
  state: { index: number; routes: { name: string }[] };
  navigation: { navigate: (name: string) => void };
};

const icons = {
  home: require("../../../assets/coms/tab-home.svg"),
  homeSelected: require("../../../assets/coms/tab-home-selected.svg"),
  order: require("../../../assets/coms/tab-order.svg"),
  orderSelected: require("../../../assets/coms/tab-order-selected.svg"),
  message: require("../../../assets/coms/tab-message.svg"),
  messageSelected: require("../../../assets/coms/tab-message-selected.svg"),
  mine: require("../../../assets/coms/tab-mine.svg"),
  mineSelected: require("../../../assets/coms/tab-mine-selected.svg"),
  publish: require("../../../assets/home/h_publish.svg"),
};

export function AppTabBar({ state, navigation }: AppTabBarProps) {
  const insets = useSafeAreaInsets();
  // Expo Router names the home tab route "index", while the visual tab key is "home".
  // Normalize it so the selected home asset is used when the index screen is active.
  const activeRoute = state.routes[state.index]?.name;
  const active = activeRoute === "index" ? "home" : activeRoute;
  const items = [
    { label: "首页", icon: active === "home" ? icons.homeSelected : icons.home, active: active === "home" },
    { label: "订单", icon: active === "order" ? icons.orderSelected : icons.order, active: active === "order" },
    { label: "消息", icon: active === "message" ? icons.messageSelected : icons.message, active: active === "message" },
    { label: "我的", icon: active === "mine" ? icons.mineSelected : icons.mine, active: active === "mine" },
  ];

  return (
    <View style={[styles.bottom, { height: 60 + insets.bottom, paddingBottom: insets.bottom }]}>
      {items.slice(0, 2).map((item, index) => (
        <Pressable key={item.label} style={styles.bottomItem} onPress={() => navigation.navigate(index ? "order" : "index")}>
          <Image source={item.icon} style={styles.bottomIcon} />
          <Text style={[styles.bottomLabel, item.active && styles.bottomActive]}>{item.label}</Text>
        </Pressable>
      ))}
      <Pressable accessibilityLabel="快速匹配" style={styles.match} onPress={() => router.push("/match")}>
        <Image source={icons.publish} style={styles.publish} />
      </Pressable>
      {items.slice(2).map((item) => (
        <Pressable key={item.label} style={styles.bottomItem} onPress={() => navigation.navigate(item.label === "我的" ? "mine" : "message")}>
          <Image source={item.icon} style={styles.bottomIcon} />
          <Text style={[styles.bottomLabel, item.active && styles.bottomActive]}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export const HomeBottomNav = AppTabBar;

const styles = StyleSheet.create({
  bottom: { position: "absolute", left: 0, right: 0, bottom: 0, minHeight: 60, backgroundColor: "#fff", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#EBEBEB", flexDirection: "row", alignItems: "flex-start", justifyContent: "space-around", paddingTop: 1 },
  bottomItem: { flex: 1, height: 48, alignItems: "center", paddingTop: 1, gap: 1 },
  bottomIcon: { width: 30, height: 30 },
  bottomLabel: { fontFamily: DOUYIN_SANS, color: "#c8c8cc", fontSize: 11 },
  bottomActive: { fontFamily: DOUYIN_SANS, color: "#333" },
  match: { width: 71, height: 60, alignItems: "center", justifyContent: "center" },
  publish: { width: 48, height: 48 },
});
