import { useMemo } from "react";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from "@esports/auth";
import { DOUYIN_SANS } from "@/shared/theme/typography";

const avatar = require("../../../../assets/mine/figma/mine-avatar.png");
const female = require("../../../../assets/mine/figma/mine-female.svg");
const clubFlag = require("../../../../assets/mine/figma/mine-club-flag.svg");
const copyIcon = require("../../../../assets/mine/figma/mine-copy.svg");
const arrow = require("../../../../assets/mine/figma/mine-arrow-right.svg");
const room = require("../../../../assets/mine/figma/mine-room-figma.svg");
const playCenter = require("../../../../assets/mine/figma/mine-play-center.svg");
const building = require("../../../../assets/mine/figma/mine-club-entry.svg");
const settings = require("../../../../assets/mine/figma/mine-settings-figma.svg");

export default function MineScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const displayName = useMemo(() => user?.phone ? `${user.phone.slice(0, 3)}****${user.phone.slice(-4)}` : "登录 / 注册", [user]);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 60 + insets.bottom }} showsVerticalScrollIndicator={false}>
        <Pressable style={styles.profile} onPress={() => !user && router.push("/login")}>
          <Image source={avatar} style={styles.avatar} />
          <View style={styles.profileCopy}>
            <Text style={styles.name}>{user ? displayName : "嘎叽嘎叽嘎叽哒"}</Text>
            <View style={styles.detailLine}><Image source={female} style={styles.tinyIcon} /><Text style={styles.age}>24</Text><Image source={clubFlag} style={styles.tinyIcon} /><Text style={styles.club}>盼之电竞自营俱乐部</Text></View>
            <View style={styles.detailLine}><Text style={styles.uid}>{user ? `ID: ${user.id}` : "ID: 136749520"}</Text><Image source={copyIcon} style={styles.copyIcon} /></View>
          </View>
          <Pressable style={styles.homepage} onPress={() => undefined}><Text style={styles.homepageText}>个人主页</Text><Image source={arrow} style={styles.arrow} /></Pressable>
        </Pressable>
        <View style={styles.statsCard}>
          <View style={styles.stat}><Text style={styles.statValue}>100</Text><Text style={styles.statLabel}>星钻</Text></View>
          <View style={styles.stat}><Text style={styles.statValue}>12</Text><Text style={styles.statLabel}>关注</Text></View>
          <View style={styles.stat}><Text style={styles.statValue}>2000</Text><Text style={styles.statLabel}>粉丝</Text></View>
        </View>
        <View style={styles.sectionCard}>
          <MenuRow icon={room} title="我的房间" onPress={() => undefined} />
          <MenuRow icon={playCenter} title="陪玩中心" onPress={() => undefined} />
          <MenuRow icon={building} title="俱乐部入驻" onPress={() => undefined} />
          <MenuRow icon={settings} title="基础设置" onPress={() => undefined} />
        </View>
      </ScrollView>
    </View>
  );
}

function MenuRow({ icon, title, subtitle, onPress }: { icon: number; title: string; subtitle?: string; onPress: () => void }) {
  return <Pressable style={styles.menuRow} onPress={onPress}><Image source={icon} style={styles.menuIcon} /><View style={styles.menuCopy}><Text style={styles.menuTitle}>{title}</Text>{subtitle && <Text style={styles.menuSubtitle}>{subtitle}</Text>}</View><Text style={styles.chevron}>›</Text></Pressable>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F7F7" }, profile: { minHeight: 80, paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 12 }, avatar: { width: 56, height: 56, borderRadius: 28 }, profileCopy: { flex: 1, gap: 4 }, name: { fontFamily: DOUYIN_SANS, color: "#0A0A0A", fontSize: 16, lineHeight: 24, fontWeight: "500" }, detailLine: { flexDirection: "row", alignItems: "center", gap: 4 }, tinyIcon: { width: 12, height: 12 }, age: { fontFamily: DOUYIN_SANS, color: "#FF4D70", fontSize: 12 }, club: { fontFamily: DOUYIN_SANS, color: "#666", fontSize: 11 }, uid: { fontFamily: DOUYIN_SANS, color: "#999", fontSize: 11 }, copyIcon: { width: 14, height: 14 }, homepage: { flexDirection: "row", alignItems: "center", gap: 2 }, homepageText: { fontFamily: DOUYIN_SANS, color: "#0A0A0A", fontSize: 11 }, arrow: { width: 16, height: 16 },
  statsCard: { marginHorizontal: 12, paddingHorizontal: 12, paddingVertical: 16, borderRadius: 8, backgroundColor: "#fff", flexDirection: "row", alignItems: "center", gap: 12 }, stat: { flex: 1, alignItems: "center", gap: 2 }, statValue: { fontFamily: DOUYIN_SANS, color: "#0A0A0A", fontSize: 16, lineHeight: 24, fontWeight: "500" }, statLabel: { fontFamily: DOUYIN_SANS, color: "#999", fontSize: 11, lineHeight: 16 },
  sectionCard: { marginHorizontal: 12, marginTop: 12, padding: 12, borderRadius: 8, backgroundColor: "#fff", gap: 12 }, menuRow: { minHeight: 32, flexDirection: "row", alignItems: "center", gap: 2 }, menuIcon: { width: 32, height: 32, marginRight: 2 }, menuCopy: { flex: 1 }, menuTitle: { fontFamily: DOUYIN_SANS, color: "#0A0A0A", fontSize: 11, lineHeight: 16 }, menuSubtitle: { marginTop: 3, fontFamily: DOUYIN_SANS, color: "#aaa", fontSize: 11 }, chevron: { color: "#b6b6b6", fontSize: 28, fontWeight: "300" },
});
