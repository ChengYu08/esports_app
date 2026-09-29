import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { demoClubs } from "../api/home.mock";
import { DOUYIN_SANS } from "@/shared/theme/typography";

const clubCover = require("../../../../assets/home/h_banner.png");
const userIcon = require("../../../../assets/home/h_user.svg");
const idIcon = require("../../../../assets/home/h_id.svg");

const members = [
  { name: "专业躺赢选手", subtitle: "王牌陪玩 · 空闲中", color: "#E9B09B" },
  { name: "温柔小法师", subtitle: "高级陪玩 · 空闲中", color: "#9BB9D6" },
  { name: "清风陪你玩", subtitle: "技术陪玩 · 忙碌中", color: "#B7A4D1" },
];

export default function ClubDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [tab, setTab] = useState<"members" | "intro">("members");
  const club = useMemo(() => Object.values(demoClubs).flat().find((item) => item.id === id) ?? demoClubs.pc[0], [id]);

  return (
    <View style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}>
        <View style={styles.hero}>
          <Image source={clubCover} contentFit="cover" style={StyleSheet.absoluteFill} />
          <View style={styles.heroShade} />
          <Pressable accessibilityLabel="返回" hitSlop={12} style={[styles.back, { top: insets.top + 10 }]} onPress={() => router.back()}><Text style={styles.backText}>‹</Text></Pressable>
          <View style={styles.heroInfo}>
            <View style={styles.logo}><Text style={styles.logoText}>{club.name.slice(0, 1)}</Text></View>
            <View style={styles.heroCopy}><Text style={styles.clubName}>{club.name}</Text><Text style={styles.clubStatus}>● {club.onlineCount}人在线</Text></View>
          </View>
        </View>
        <View style={styles.content}>
          <View style={styles.stats}><Stat value={club.memberCount} label="俱乐部成员" /><Stat value={club.onlineCount} label="当前在线" /><Stat value="100%" label="好评率" /></View>
          <View style={styles.metaRow}><Text style={styles.meta}><Image source={userIcon} style={styles.metaIcon} /> {club.memberCount}人</Text><Text style={styles.meta}><Image source={idIcon} style={styles.metaIcon} /> {club.clubCode}</Text></View>
          <Text style={styles.description}>{club.description}，欢迎来到俱乐部一起游戏，享受轻松愉快的陪玩时光。</Text>
          <View style={styles.tabs}><Tab label="陪玩成员" active={tab === "members"} onPress={() => setTab("members")} /><Tab label="俱乐部介绍" active={tab === "intro"} onPress={() => setTab("intro")} /></View>
          {tab === "members" ? <View style={styles.memberList}>{members.map((member) => <Member key={member.name} {...member} />)}</View> : <View style={styles.intro}><Text style={styles.introTitle}>俱乐部介绍</Text><Text style={styles.introText}>{club.description}。我们致力于为玩家提供专业、友好的游戏陪伴服务，欢迎加入我们。</Text></View>}
        </View>
      </ScrollView>
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}><Pressable style={styles.joinButton} onPress={() => undefined}><Text style={styles.joinText}>申请加入俱乐部</Text></Pressable></View>
    </View>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) { return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>; }
function Tab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) { return <Pressable onPress={onPress} style={styles.tab}><Text style={[styles.tabText, active && styles.tabActive]}>{label}</Text>{active && <View style={styles.indicator} />}</Pressable>; }
function Member({ name, subtitle, color }: { name: string; subtitle: string; color: string }) { return <Pressable style={styles.member} onPress={() => undefined}><View style={[styles.memberAvatar, { backgroundColor: color }]}><Text style={styles.memberInitial}>{name.slice(0, 1)}</Text></View><View style={styles.memberCopy}><Text style={styles.memberName}>{name}</Text><Text style={styles.memberSubtitle}>{subtitle}</Text></View><Text style={styles.memberArrow}>›</Text></Pressable>; }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F7F7" }, hero: { height: 248, overflow: "hidden", backgroundColor: "#6D7783" }, heroShade: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(20,28,40,.38)" }, back: { position: "absolute", left: 18, width: 32, height: 32, alignItems: "center", justifyContent: "center" }, backText: { color: "#fff", fontSize: 38, lineHeight: 32, fontWeight: "200" }, heroInfo: { position: "absolute", left: 20, right: 20, bottom: 24, flexDirection: "row", alignItems: "center", gap: 14 }, logo: { width: 68, height: 68, borderRadius: 16, backgroundColor: "#24354b", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,.7)" }, logoText: { color: "#fff", fontSize: 30, fontWeight: "800" }, heroCopy: { flex: 1, gap: 7 }, clubName: { color: "#fff", fontFamily: DOUYIN_SANS, fontSize: 20, fontWeight: "600" }, clubStatus: { color: "#52D795", fontFamily: DOUYIN_SANS, fontSize: 13 }, content: { marginTop: -12, borderTopLeftRadius: 16, borderTopRightRadius: 16, backgroundColor: "#fff", paddingHorizontal: 16, paddingTop: 22 }, stats: { flexDirection: "row", justifyContent: "space-around" }, stat: { alignItems: "center", gap: 4 }, statValue: { color: "#111", fontFamily: DOUYIN_SANS, fontSize: 20, fontWeight: "700" }, statLabel: { color: "#999", fontFamily: DOUYIN_SANS, fontSize: 12 }, metaRow: { flexDirection: "row", gap: 18, marginTop: 18 }, meta: { color: "#999", fontFamily: DOUYIN_SANS, fontSize: 12 }, metaIcon: { width: 13, height: 13 }, description: { marginTop: 14, color: "#333", fontFamily: DOUYIN_SANS, fontSize: 14, lineHeight: 22 }, tabs: { flexDirection: "row", gap: 28, height: 58, alignItems: "flex-end" }, tab: { height: 44, minWidth: 72, alignItems: "center", justifyContent: "center", position: "relative" }, tabText: { color: "#888", fontFamily: DOUYIN_SANS, fontSize: 16 }, tabActive: { color: "#111", fontWeight: "600" }, indicator: { position: "absolute", bottom: 0, width: 20, height: 3, borderRadius: 2, backgroundColor: "#FF3158" }, memberList: { gap: 2 }, member: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#eee" }, memberAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" }, memberInitial: { color: "#fff", fontSize: 20, fontWeight: "700" }, memberCopy: { flex: 1, gap: 5 }, memberName: { color: "#111", fontFamily: DOUYIN_SANS, fontSize: 15, fontWeight: "600" }, memberSubtitle: { color: "#999", fontFamily: DOUYIN_SANS, fontSize: 12 }, memberArrow: { color: "#bbb", fontSize: 26 }, intro: { paddingVertical: 24 }, introTitle: { color: "#111", fontFamily: DOUYIN_SANS, fontSize: 17, fontWeight: "600" }, introText: { marginTop: 12, color: "#555", fontFamily: DOUYIN_SANS, fontSize: 14, lineHeight: 24 }, bottomBar: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 10, backgroundColor: "#fff", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#eee" }, joinButton: { height: 46, borderRadius: 23, backgroundColor: "#FF3158", alignItems: "center", justifyContent: "center" }, joinText: { color: "#fff", fontFamily: DOUYIN_SANS, fontSize: 16, fontWeight: "600" },
});
