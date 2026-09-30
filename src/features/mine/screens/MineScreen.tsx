import { DOUYIN_SANS } from "@/shared/theme/typography";
import { useAuthStore } from "@esports/auth";
import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const avatar = require("../../../../assets/mine/figma/mine-avatar.png");
const female = require("../../../../assets/mine/figma/mine-female.svg");
const clubFlag = require("../../../../assets/mine/figma/mine-club-flag.svg");
const copyIcon = require("../../../../assets/mine/figma/mine-copy.svg");
const arrow = require("../../../../assets/mine/figma/mine-arrow-right.svg");
const room = require("../../../../assets/mine/figma/mine-room-figma.svg");
const playCenter = require("../../../../assets/mine/figma/mine-play-center.svg");
const building = require("../../../../assets/mine/figma/mine-club-entry.svg");
const settings = require("../../../../assets/mine/figma/mine-setting-entry.svg");

export default function MineScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const [copySuccessVisible, setCopySuccessVisible] = useState(false);
  const copySuccessTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const displayName = useMemo(
    () =>
      user?.nickname ||
      (user?.phone
        ? `${user.phone.slice(0, 3)}****${user.phone.slice(-4)}`
        : "登录 / 注册"),
    [user],
  );
  const copyUserId = async () => {
    if (!user?.id) return;
    await Clipboard.setStringAsync(String(user.id));
    if (copySuccessTimer.current) clearTimeout(copySuccessTimer.current);
    setCopySuccessVisible(true);
    copySuccessTimer.current = setTimeout(() => {
      setCopySuccessVisible(false);
      copySuccessTimer.current = null;
    }, 1800);
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top,
          paddingBottom: 60 + insets.bottom,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profile}>
          <Pressable
            style={styles.profileMain}
            onPress={() => !user && router.push("/login")}
          >
            <Image
              source={user?.headImage ? { uri: user.headImage } : avatar}
              style={styles.avatar}
            />
            <View style={styles.profileCopy}>
              <Text style={styles.name}>{displayName}</Text>
              <View style={styles.detailLine}>
                {user?.gender === 2 ? (
                  <Image source={female} style={styles.tinyIcon} />
                ) : null}
                {user?.clubInfo ? (
                  <>
                    <Image source={clubFlag} style={styles.tinyIcon} />
                    <Text style={styles.club}>{user.clubInfo.clubName}</Text>
                  </>
                ) : null}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="复制用户 ID"
                hitSlop={8}
                onPress={() => void copyUserId()}
                style={styles.detailLine}
              >
                <Text style={styles.uid}>
                  {user ? `ID: ${user.id}` : "登录后查看 ID"}
                </Text>
                {user ? (
                  <Image source={copyIcon} style={styles.copyIcon} />
                ) : null}
              </Pressable>
            </View>
          </Pressable>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="个人主页"
            hitSlop={10}
            style={styles.homepage}
            onPress={() => {
              if (user?.clubInfo?.id && user.id) {
                router.push({
                  pathname: "/profile",
                  params: {
                    clubId: String(user.clubInfo.id),
                    userId: String(user.id),
                  },
                });
                return;
              }
              router.push("/profile");
            }}
          >
            <Text style={styles.homepageText}>个人主页</Text>
            <Image source={arrow} style={styles.arrow} />
          </Pressable>
        </View>
        <View style={styles.statsCard}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{user?.starBalance ?? "--"}</Text>
            <Text style={styles.statLabel}>星钻</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>关注</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>粉丝</Text>
          </View>
        </View>
        <View style={styles.sectionCard}>
          <MenuRow icon={room} title="我的房间" onPress={() => undefined} />
          <MenuRow
            icon={playCenter}
            title="陪玩中心"
            onPress={() => undefined}
          />
          <MenuRow
            icon={building}
            title="俱乐部入驻"
            onPress={() => undefined}
          />
          <MenuRow
            icon={settings}
            title="基础设置"
            onPress={() => router.push("/account-settings")}
          />
        </View>
      </ScrollView>
      {copySuccessVisible ? (
        <View
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
          pointerEvents="none"
          style={[styles.copyToast, { top: insets.top + 16 }]}
        >
          <View style={styles.copyToastCheck}><Text style={styles.copyToastCheckText}>✓</Text></View>
          <View>
            <Text style={styles.copyToastTitle}>复制成功</Text>
            <Text style={styles.copyToastHint}>ID 已复制到剪贴板</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function MenuRow({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: number;
  title: string;
  subtitle?: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.menuRow} onPress={onPress}>
      <Image source={icon} style={styles.menuIcon} />
      <View style={styles.menuCopy}>
        <Text style={styles.menuTitle}>{title}</Text>
        {subtitle && <Text style={styles.menuSubtitle}>{subtitle}</Text>}
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F7F7" },
  copyToast: {
    position: "absolute",
    alignSelf: "center",
    minWidth: 172,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: "rgba(24, 24, 27, 0.94)",
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  copyToastCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FF3158",
  },
  copyToastCheckText: { color: "#fff", fontSize: 14, fontWeight: "700", lineHeight: 17 },
  copyToastTitle: { color: "#fff", fontFamily: DOUYIN_SANS, fontSize: 13, fontWeight: "600", lineHeight: 18 },
  copyToastHint: { color: "#BFC0C5", fontFamily: DOUYIN_SANS, fontSize: 11, lineHeight: 16 },
  profile: {
    minHeight: 80,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  profileMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  profileCopy: { flex: 1, gap: 4 },
  name: {
    fontFamily: DOUYIN_SANS,
    color: "#0A0A0A",
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "500",
  },
  detailLine: { flexDirection: "row", alignItems: "center", gap: 4 },
  tinyIcon: { width: 12, height: 12 },
  age: { fontFamily: DOUYIN_SANS, color: "#FF4D70", fontSize: 12 },
  club: { fontFamily: DOUYIN_SANS, color: "#666", fontSize: 11 },
  uid: { fontFamily: DOUYIN_SANS, color: "#999", fontSize: 11 },
  copyIcon: { width: 14, height: 14 },
  homepage: { flexDirection: "row", alignItems: "center", gap: 2 },
  homepageText: { fontFamily: DOUYIN_SANS, color: "#0A0A0A", fontSize: 11 },
  arrow: { width: 16, height: 16 },
  statsCard: {
    marginHorizontal: 12,
    paddingHorizontal: 12,
    paddingVertical: 16,
    borderRadius: 8,
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  stat: { flex: 1, alignItems: "center", gap: 2 },
  statValue: {
    fontFamily: DOUYIN_SANS,
    color: "#0A0A0A",
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "500",
  },
  statLabel: {
    fontFamily: DOUYIN_SANS,
    color: "#999",
    fontSize: 11,
    lineHeight: 16,
  },
  sectionCard: {
    marginHorizontal: 12,
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#fff",
    gap: 12,
  },
  menuRow: {
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  menuIcon: { width: 32, height: 32, marginRight: 2 },
  menuCopy: { flex: 1 },
  menuTitle: {
    fontFamily: DOUYIN_SANS,
    color: "#0A0A0A",
    fontSize: 11,
    lineHeight: 16,
  },
  menuSubtitle: {
    marginTop: 3,
    fontFamily: DOUYIN_SANS,
    color: "#aaa",
    fontSize: 11,
  },
  chevron: { color: "#b6b6b6", fontSize: 28, fontWeight: "300" },
});
