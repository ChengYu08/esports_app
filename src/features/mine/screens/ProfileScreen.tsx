import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from "@esports/auth";

import { DOUYIN_SANS } from "@/shared/theme/typography";

const fallbackAvatar = require("../../../../assets/mine/figma/profile-avatar.png");
const background = require("../../../../assets/mine/figma/profile-bg.png");
const femaleIcon = require("../../../../assets/mine/figma/mine-female.svg");
const clubIcon = require("../../../../assets/mine/figma/mine-club-flag.svg");
const gameLogo = require("../../../../assets/mine/figma/profile-game-logo.png");
const workImage = require("../../../../assets/mine/figma/profile-work-1.png");
const settingsIcon = require("../../../../assets/mine/figma/mine-settings-figma.svg");

type ProfileTab = "技能" | "评价";

const otherProfile = {
  id: "10008642",
  name: "专业躺赢选手",
  avatar: fallbackAvatar,
  signature: "唯有热爱方能抵御岁月漫长，这是一段自我介绍。唯有热爱方能抵御岁月漫长，这是⼀段自我介绍",
  club: "盼之电竞自营俱乐部",
  gender: 1,
  following: 578,
  followers: 9988,
  tags: ["三角洲端游", "三角洲手游"],
};

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const { userId } = useLocalSearchParams<{ userId?: string }>();
  const [tab, setTab] = useState<ProfileTab>("技能");
  const isMine = !userId || String(user?.id ?? "") === String(userId);

  const profile = useMemo(() => {
    if (!isMine) return otherProfile;
    return {
      ...otherProfile,
      id: user?.id ?? "--",
      name: user?.nickname || "登录 / 注册",
      avatar: user?.headImage ? { uri: user.headImage } : fallbackAvatar,
      club: user?.clubInfo?.clubName || otherProfile.club,
      gender: user?.gender,
      signature: user?.signature || otherProfile.signature,
    };
  }, [isMine, user]);

  return (
    <View style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: isMine ? 24 + insets.bottom : 88 + insets.bottom }}>
        <View style={styles.cover}>
          <Image source={background} contentFit="cover" style={StyleSheet.absoluteFill} />
          <View style={styles.coverShade} />
          <View style={[styles.navbar, { paddingTop: insets.top }]}>
            <View style={styles.navSpacer} />
            <Pressable accessibilityLabel="设置" hitSlop={12} onPress={() => undefined}>
              <Image source={settingsIcon} style={styles.settingsIcon} />
            </Pressable>
          </View>
          <View style={styles.identity}>
            <Image source={profile.avatar} style={styles.avatar} />
            <View style={styles.identityCopy}>
              <View style={styles.nameRow}>
                <Text style={styles.name}>{profile.name}</Text>
                {profile.gender === 2 ? <Image source={femaleIcon} style={styles.gender} /> : <Text style={styles.male}>♂ 24</Text>}
                <View style={styles.online}><Text style={styles.onlineText}>♙ 空闲中</Text></View>
              </View>
              <View style={styles.clubLine}>
                <Image source={clubIcon} style={styles.clubIcon} />
                <Text style={styles.club}>{profile.club}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.stats}>
            <Stat value={profile.following} label="关注" />
            <Stat value={profile.followers} label="粉丝" />
          </View>
          <Text style={styles.signature}>{profile.signature}</Text>
          <View style={styles.tabs}>
            {(["技能", "评价"] as ProfileTab[]).map((item) => (
              <Pressable key={item} onPress={() => setTab(item)} style={styles.tabButton}>
                <Text style={[styles.tabText, tab === item && styles.tabTextActive]}>{item}</Text>
                {tab === item ? <View style={styles.tabIndicator} /> : null}
              </Pressable>
            ))}
          </View>
          {tab === "技能" ? <SkillsContent /> : <ReviewsContent />}
        </View>
      </ScrollView>

      {!isMine ? (
        <View style={[styles.actionBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Pressable style={styles.followButton} onPress={() => undefined}><Text style={styles.followText}>关注</Text></Pressable>
          <Pressable style={styles.chatButton} onPress={() => undefined}><Text style={styles.chatText}>聊一聊</Text></Pressable>
        </View>
      ) : null}
    </View>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

function SkillsContent() {
  return (
    <>
      <View style={styles.gameTags}><GameTag active text="三角洲端游" /><GameTag text="三角洲手游" /></View>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>能力介绍</Text>
        <View style={styles.voice}><Text style={styles.play}>▶</Text><Text style={styles.voiceText}>〽 12″</Text></View>
      </View>
      <Text style={styles.description}>擅长：跑刀、夜陪、刷物资{"\n"}简介：枪法超稳，出车效率高，清一色暖男声线，情绪价值拉满，你的日常陪伴这是⼀段介绍，这是⼀段介绍这是⼀段介绍{"\n"}支持开麦实时报点，也可安静作战，服从老板命令</Text>
      <View style={styles.gallery}>{[0, 1, 2, 3, 4].map((item) => <View key={item} style={styles.galleryItem}><Image source={workImage} contentFit="cover" style={StyleSheet.absoluteFill} />{item === 4 ? <View style={styles.moreOverlay}><Text style={styles.moreText}>+3</Text></View> : null}</View>)}</View>
      <Text style={[styles.sectionTitle, styles.serviceTitle]}>陪玩服务</Text>
      {[0, 1].map((item) => <ServiceCard key={item} />)}
    </>
  );
}

function ReviewsContent() {
  return <View style={styles.reviewEmpty}><Text style={styles.reviewScore}>暂无评价</Text><Text style={styles.reviewHint}>完成订单后会显示评价内容</Text></View>;
}

function GameTag({ active, text }: { active?: boolean; text: string }) {
  return <View style={[styles.gameTag, active && styles.gameTagActive]}><Image source={gameLogo} style={styles.gameLogo} /><Text style={[styles.gameText, active && styles.gameTextActive]}>{text}</Text></View>;
}

function ServiceCard() {
  return <View style={styles.serviceCard}><View style={styles.serviceCopy}><Text style={styles.serviceName}>三角洲端游-模式-等级</Text><View style={styles.serviceMeta}><Text style={styles.price}>300</Text><Text style={styles.diamond}>◇</Text><Text style={styles.metaText}>订单333</Text><Text style={styles.metaText}>100%好评</Text></View></View><Pressable style={styles.orderButton} onPress={() => undefined}><Text style={styles.orderText}>下单</Text></Pressable></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff" },
  cover: { height: 185, overflow: "hidden", backgroundColor: "#617181" },
  coverShade: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(24,35,47,0.52)" },
  navbar: { height: 68, paddingHorizontal: 20, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  navSpacer: { width: 24, height: 24 },
  settingsIcon: { width: 24, height: 24, tintColor: "#fff" },
  identity: { position: "absolute", left: 16, right: 16, bottom: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 72, height: 72, borderRadius: 36, borderWidth: 1, borderColor: "#fff" },
  identityCopy: { flex: 1, minWidth: 0, gap: 6 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  name: { flexShrink: 1, color: "#fff", fontFamily: DOUYIN_SANS, fontSize: 16, lineHeight: 22, fontWeight: "600" },
  gender: { width: 15, height: 15 },
  male: { flexShrink: 0, color: "#1AA9FF", backgroundColor: "rgba(28,78,108,0.5)", borderRadius: 10, paddingHorizontal: 5, paddingVertical: 1, fontSize: 12 },
  online: { flexShrink: 0, backgroundColor: "rgba(22,88,78,0.48)", borderRadius: 10, paddingHorizontal: 5, paddingVertical: 1 },
  onlineText: { color: "#19D58B", fontFamily: DOUYIN_SANS, fontSize: 12 },
  clubLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  clubIcon: { width: 14, height: 14, tintColor: "#D7DCE2" },
  club: { flexShrink: 1, color: "#C9CED4", fontFamily: DOUYIN_SANS, fontSize: 12 },
  content: { marginTop: -1, paddingHorizontal: 16, backgroundColor: "#fff", borderTopLeftRadius: 12, borderTopRightRadius: 12, paddingTop: 16 },
  stats: { flexDirection: "row", gap: 16 },
  stat: { flexDirection: "row", alignItems: "baseline", gap: 5 },
  statValue: { color: "#111", fontFamily: DOUYIN_SANS, fontSize: 20, lineHeight: 28, fontWeight: "700" },
  statLabel: { color: "#999", fontFamily: DOUYIN_SANS, fontSize: 14 },
  signature: { marginTop: 12, color: "#161616", fontFamily: DOUYIN_SANS, fontSize: 14, lineHeight: 21 },
  tabs: { flexDirection: "row", gap: 28, height: 48, alignItems: "flex-end" },
  tabButton: { height: 42, minWidth: 36, alignItems: "center", justifyContent: "center", position: "relative" },
  tabText: { color: "#777", fontFamily: DOUYIN_SANS, fontSize: 16 },
  tabTextActive: { color: "#111", fontWeight: "600" },
  tabIndicator: { position: "absolute", bottom: 0, width: 12, height: 3, borderRadius: 2, backgroundColor: "#FF3158" },
  gameTags: { flexDirection: "row", gap: 10, marginTop: 12 },
  gameTag: { height: 32, paddingHorizontal: 6, borderRadius: 6, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#F5F5F5" },
  gameTagActive: { borderWidth: 1, borderColor: "#FF3158", backgroundColor: "#fff" },
  gameLogo: { width: 20, height: 20, borderRadius: 4 },
  gameText: { color: "#777", fontFamily: DOUYIN_SANS, fontSize: 14 },
  gameTextActive: { color: "#111" },
  sectionHeader: { marginTop: 24, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { color: "#111", fontFamily: DOUYIN_SANS, fontSize: 16, fontWeight: "600" },
  voice: { height: 24, paddingHorizontal: 6, borderRadius: 12, backgroundColor: "#FF3158", flexDirection: "row", alignItems: "center", gap: 4 },
  play: { color: "#FF3158", backgroundColor: "#fff", width: 17, height: 17, borderRadius: 9, textAlign: "center", lineHeight: 17, fontSize: 8 },
  voiceText: { color: "#fff", fontSize: 12 },
  description: { marginTop: 14, color: "#222", fontFamily: DOUYIN_SANS, fontSize: 14, lineHeight: 20 },
  gallery: { flexDirection: "row", justifyContent: "space-between", marginTop: 14 },
  galleryItem: { width: 65, height: 65, overflow: "hidden", borderRadius: 5, backgroundColor: "#ddd" },
  moreOverlay: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center" },
  moreText: { color: "#fff", fontSize: 18, fontWeight: "600" },
  serviceTitle: { marginTop: 28 },
  serviceCard: { minHeight: 67, marginTop: 16, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8, backgroundColor: "#F7F7F7", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  serviceCopy: { flex: 1, minWidth: 0, gap: 6 },
  serviceName: { color: "#111", fontFamily: DOUYIN_SANS, fontSize: 14, fontWeight: "600" },
  serviceMeta: { flexDirection: "row", alignItems: "center", gap: 7 },
  price: { color: "#FF3158", fontFamily: DOUYIN_SANS, fontSize: 16, fontWeight: "600" },
  diamond: { color: "#FF3158", fontSize: 14 },
  metaText: { color: "#999", fontFamily: DOUYIN_SANS, fontSize: 12 },
  orderButton: { flexShrink: 0, width: 48, height: 28, borderRadius: 14, backgroundColor: "#FF3158", alignItems: "center", justifyContent: "center" },
  orderText: { color: "#fff", fontFamily: DOUYIN_SANS, fontSize: 14 },
  reviewEmpty: { alignItems: "center", paddingVertical: 90 },
  reviewScore: { color: "#777", fontSize: 16 },
  reviewHint: { marginTop: 8, color: "#aaa", fontSize: 13 },
  actionBar: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 12, paddingTop: 8, backgroundColor: "#fff", flexDirection: "row", gap: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#eee" },
  followButton: { flex: 1, height: 42, borderRadius: 7, borderWidth: 1, borderColor: "#E5E5E5", alignItems: "center", justifyContent: "center" },
  followText: { color: "#111", fontFamily: DOUYIN_SANS, fontSize: 16, fontWeight: "600" },
  chatButton: { flex: 1, height: 42, borderRadius: 7, backgroundColor: "#FF3158", alignItems: "center", justifyContent: "center" },
  chatText: { color: "#fff", fontFamily: DOUYIN_SANS, fontSize: 16, fontWeight: "600" },
});
