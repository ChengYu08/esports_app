import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { DOUYIN_SANS } from "@/shared/theme/typography";

const icons = {
  home: require("../../../../assets/home/h_home-selected.svg"),
  order: require("../../../../assets/coms/tab-order-selected.svg"),
  message: require("../../../../assets/coms/tab-message-selected.svg"),
  mine: require("../../../../assets/coms/tab-mine-selected.svg"),
  publish: require("../../../../assets/home/h_publish.svg"),
};

export function HomeBottomNav({ insetsBottom, active = "home" }: { insetsBottom: number; active?: "home" | "mine" }) {
  const items = [
    { label: "首页", icon: icons.home, active: active === "home" },
    { label: "订单", icon: icons.order },
    { label: "消息", icon: icons.message },
    { label: "我的", icon: icons.mine, active: active === "mine" },
  ];

  return (
    <View style={[styles.bottom, { paddingBottom: Math.max(8, insetsBottom) }]}>
      {items.slice(0, 2).map((item, index) => (
        <Pressable key={item.label} style={styles.bottomItem} onPress={() => (index ? router.push("/login") : undefined)}>
          <Image source={item.icon} style={styles.bottomIcon} />
          <Text style={[styles.bottomLabel, item.active && styles.bottomActive]}>{item.label}</Text>
        </Pressable>
      ))}
      <Pressable accessibilityLabel="快速匹配" style={styles.match} onPress={() => router.push("/match")}>
        <Image source={icons.publish} style={styles.publish} />
      </Pressable>
      {items.slice(2).map((item) => (
        <Pressable key={item.label} style={styles.bottomItem} onPress={() => item.label === "我的" ? router.push("/mine") : router.push("/login")}>
          <Image source={item.icon} style={styles.bottomIcon} />
          <Text style={[styles.bottomLabel, item.active && styles.bottomActive]}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bottom: { position: "absolute", left: 0, right: 0, bottom: 0, minHeight: 76, backgroundColor: "#fff", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#e7e7e7", flexDirection: "row", alignItems: "flex-start", justifyContent: "space-around", paddingTop: 7 },
  bottomItem: { width: 52, alignItems: "center", gap: 1 },
  bottomIcon: { width: 30, height: 30 },
  bottomLabel: { fontFamily: DOUYIN_SANS, color: "#c8c8cc", fontSize: 11 },
  bottomActive: { fontFamily: DOUYIN_SANS, color: "#333" },
  match: { width: 56, height: 56, marginTop: -15, alignItems: "center", justifyContent: "center" },
  publish: { width: 56, height: 56 },
});
