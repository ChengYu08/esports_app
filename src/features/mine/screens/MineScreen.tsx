import { DOUYIN_SANS } from "@/shared/theme/typography";
import { useAuthStore } from "@esports/auth";
import {
  DocumentText24Regular,
  Password24Regular,
  PersonDelete24Regular,
  PersonProhibited24Regular,
  Settings24Regular,
  ShieldKeyhole24Regular,
} from "@fluentui/react-native-icons";
import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Toast from "react-native-root-toast";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { clientAuthApi } from "@/features/auth/client-auth.api";
import { clearAuthSession } from "@/features/auth/session-persistence";
import { messageStore } from "@/features/message/message-store";

const avatar = require("../../../../assets/mine/figma/mine-avatar.png");
const female = require("../../../../assets/mine/figma/mine-female.svg");
const clubFlag = require("../../../../assets/mine/figma/mine-club-flag.svg");
const copyIcon = require("../../../../assets/mine/figma/mine-copy.svg");
const arrow = require("../../../../assets/mine/figma/mine-arrow-right.svg");
const room = require("../../../../assets/mine/figma/mine-room-figma.svg");
const playCenter = require("../../../../assets/mine/figma/mine-play-center.svg");
const building = require("../../../../assets/mine/figma/mine-club-entry.svg");

type MenuIcon = typeof Settings24Regular;

type MenuItem = {
  icon: MenuIcon;
  onPress: () => void;
  title: string;
};

export default function MineScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);
  const clearSession = useAuthStore((state) => state.clearSession);
  const [logoutVisible, setLogoutVisible] = useState(false);
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
    Toast.show("ID 已复制到剪贴板", { duration: Toast.durations.SHORT });
  };

  const confirmLogout = async () => {
    setLogoutVisible(false);
    if (accessToken)
      void clientAuthApi.logout(accessToken).catch(() => undefined);
    try {
      await clearAuthSession();
    } catch {
      /* Keep the UI signed out. */
    }
    clearSession();
    void messageStore
      .getState()
      .reset()
      .catch(() => undefined);
    router.replace("/");
  };

  const logout = () => {
    setLogoutVisible(true);
  };
  const menuItems = [
    {
      title: "基础设置",
      icon: Settings24Regular,
      onPress: () => router.push("/account-settings"),
    },
    {
      title: "修改密码",
      icon: Password24Regular,
      onPress: () =>
        router.push({
          pathname: "/forgot-password",
          params: { phone: user?.phone || "" },
        }),
    },
    {
      title: "黑名单",
      icon: PersonProhibited24Regular,
      onPress: () => router.push("/blacklist"),
    },
    {
      title: "用户协议",
      icon: DocumentText24Regular,
      onPress: () =>
        router.push({ pathname: "/protocol", params: { kind: "user" } }),
    },
    {
      title: "隐私协议",
      icon: ShieldKeyhole24Regular,
      onPress: () =>
        router.push({ pathname: "/protocol", params: { kind: "privacy" } }),
    },
    {
      title: "注销账号",
      icon: PersonDelete24Regular,
      onPress: () => router.push("/account-cancellation"),
    },
  ] satisfies readonly MenuItem[];

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
          {/* <MenuRow icon={room} title="我的房间" onPress={() => undefined} />
          <MenuRow
            icon={playCenter}
            title="陪玩中心"
            onPress={() => undefined}
          />
          <MenuRow
            icon={building}
            title="俱乐部入驻"
            onPress={() => undefined}
          /> */}
          {menuItems.map((item) => (
            <MenuRow key={item.title} {...item} />
          ))}
        </View>
        {user ? (
          <Pressable
            accessibilityRole="button"
            onPress={logout}
            style={styles.logoutButton}
          >
            <Text style={styles.logoutText}>退出登录</Text>
          </Pressable>
        ) : null}
      </ScrollView>
      <Modal
        transparent
        visible={logoutVisible}
        animationType="fade"
        onRequestClose={() => setLogoutVisible(false)}
      >
        <View style={styles.dialogBackdrop}>
          <View style={styles.logoutDialog}>
            <View style={styles.logoutMark}>
              <Text style={styles.logoutMarkText}>!</Text>
            </View>
            <Text style={styles.logoutTitle}>退出登录</Text>
            <Text style={styles.logoutMessage}>
              确认退出当前账号吗？您的数据将被清除！
            </Text>
            <View style={styles.logoutActions}>
              <Pressable
                onPress={() => setLogoutVisible(false)}
                style={styles.logoutCancel}
              >
                <Text style={styles.logoutCancelText}>取消</Text>
              </Pressable>
              <Pressable
                onPress={() => void confirmLogout()}
                style={styles.logoutConfirm}
              >
                <Text style={styles.logoutConfirmText}>退出登录</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function MenuRow({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: MenuIcon;
  title: string;
  subtitle?: string;
  onPress: () => void;
}) {
  const Icon = icon;

  return (
    <Pressable style={styles.menuRow} onPress={onPress}>
      <View style={styles.menuIcon}>
        <Icon color="#4A4A4A" height={22} width={22} />
      </View>
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
  menuIcon: {
    width: 32,
    height: 32,
    marginRight: 2,
    alignItems: "center",
    justifyContent: "center",
  },
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
  logoutButton: {
    height: 48,
    marginHorizontal: 12,
    marginTop: 28,
    marginBottom: 28,
    borderRadius: 8,
    backgroundColor: "#FFF",
    alignItems: "center",
    justifyContent: "center",
  },
  logoutText: { color: "#FF1F4C", fontFamily: DOUYIN_SANS, fontSize: 15 },
  dialogBackdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, backgroundColor: "rgba(0,0,0,0.45)" },
  logoutDialog: { width: "100%", borderRadius: 12, backgroundColor: "#FFF", padding: 24, alignItems: "center" },
  logoutMark: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#FFF1F3", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  logoutMarkText: { color: "#FF1F4C", fontSize: 22, fontWeight: "700" },
  logoutTitle: { color: "#0A0A0A", fontFamily: DOUYIN_SANS, fontSize: 17, fontWeight: "600" },
  logoutMessage: { color: "#666", fontFamily: DOUYIN_SANS, fontSize: 13, lineHeight: 20, marginTop: 8, textAlign: "center" },
  logoutActions: { width: "100%", flexDirection: "row", gap: 10, marginTop: 22 },
  logoutCancel: { flex: 1, height: 44, borderRadius: 8, backgroundColor: "#F7F7F7", alignItems: "center", justifyContent: "center" },
  logoutCancelText: { color: "#666", fontFamily: DOUYIN_SANS, fontSize: 15 },
  logoutConfirm: { flex: 1, height: 44, borderRadius: 8, backgroundColor: "#FF1F4C", alignItems: "center", justifyContent: "center" },
  logoutConfirmText: { color: "#FFF", fontFamily: DOUYIN_SANS, fontSize: 15 },
});
