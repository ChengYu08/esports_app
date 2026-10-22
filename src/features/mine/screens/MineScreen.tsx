import { DOUYIN_SANS } from "@/shared/theme/typography";
import { CachedImage } from "@/shared/ui/CachedImage";
import { useAuthStore } from "@esports/auth";
import {
  BuildingPeople24Regular,
  Dismiss24Regular,
  Password24Regular,
  PeopleCommunity24Regular,
  PersonDelete24Regular,
  PersonProhibited24Regular,
  PersonStar24Regular,
  Settings24Regular,
} from "@fluentui/react-native-icons";
import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
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
import { useUserFollowCount } from "@/features/mine/hooks/use-user-follow";
import {
  resolveVoiceRoomId,
  voiceRoomApi,
} from "@/features/voice-room/voice-room.api";
import { requireLogin } from "@/shared/navigation/require-login";

const avatar = require("../../../../assets/mine/figma/mine-avatar.png");
const female = require("../../../../assets/mine/figma/mine-female.svg");
const clubFlag = require("../../../../assets/mine/figma/mine-club-flag.svg");
const copyIcon = require("../../../../assets/mine/figma/mine-copy.svg");
const arrow = require("../../../../assets/mine/figma/mine-arrow-right.svg");
const clubEntryQrCode = require("../../../../assets/coms/qrcode-jlb.png");
const companionEntryQrCode = require("../../../../assets/coms/qrcode-pws.png");

type QrCodeModalType = "club" | "companion";

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
  // 只解构 refetch 函数作为 focus effect 的稳定依赖；整个 query result
  // 每次渲染都会生成新引用，导致接口被重复触发。
  const {
    data: followCount,
    refetch: refetchFollowCount,
  } = useUserFollowCount(user?.id);
  const [logoutVisible, setLogoutVisible] = useState(false);
  const [qrCodeModal, setQrCodeModal] = useState<QrCodeModalType | null>(null);
  const [openingVoiceRoom, setOpeningVoiceRoom] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void refetchFollowCount();
      if (accessToken && user?.id)
        void clientAuthApi
          .fetchCurrentUser(accessToken)
          .then((profile) => {
            // 余额未变化时保留原 user 对象，避免触发额外渲染和 focus 循环。
            useAuthStore.setState((state) =>
              state.user?.id !== String(profile.id) ||
              state.user.starBalance === profile.starBalance
                ? state
                : { user: { ...state.user, starBalance: profile.starBalance } },
            );
          })
          .catch(() => undefined);
    }, [refetchFollowCount, accessToken, user?.id]),
  );
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
  const openRelations = (type: "following" | "fans") => {
    if (!requireLogin() || !user?.id) return;
    router.push({
      pathname: "/profile-relations",
      params: {
        userId: String(user.id),
        type,
        ...(user.clubInfo?.id ? { clubId: String(user.clubInfo.id) } : {}),
      },
    });
  };
  const openStarRecharge = () => {
    if (!requireLogin()) return;
    router.push("/star-recharge");
  };
  const openMyRoom = async () => {
    if (!requireLogin() || !accessToken || openingVoiceRoom) return;
    setOpeningVoiceRoom(true);
    try {
      let room = await voiceRoomApi
        .getJoinedRoom(accessToken)
        .catch(() => null);
      if (!resolveVoiceRoomId(room))
        room = await voiceRoomApi.createRoom("我的语聊房", accessToken);
      const roomId = resolveVoiceRoomId(room);
      if (!roomId) throw new Error("房间信息不完整，请稍后重试");
      router.push({ pathname: "/voice-room/[id]", params: { id: roomId } });
    } catch (error) {
      Toast.show(
        error instanceof Error ? error.message : "进入语聊房失败，请稍后重试",
        {
          duration: Toast.durations.SHORT,
        },
      );
    } finally {
      setOpeningVoiceRoom(false);
    }
  };
  const menuItems = [
    {
      title: openingVoiceRoom ? "正在进入房间" : "我的房间",
      icon: PeopleCommunity24Regular,
      onPress: () => void openMyRoom(),
    },
    {
      title: "基础设置",
      icon: Settings24Regular,
      onPress: () => router.push("/basic-settings"),
    },
    {
      title: "俱乐部入驻",
      icon: BuildingPeople24Regular,
      onPress: () => setQrCodeModal("club"),
    },
    {
      title: "成为陪玩师",
      icon: PersonStar24Regular,
      onPress: () => setQrCodeModal("companion"),
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
          <View style={styles.profileMain}>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={user ? "账号设置" : "登录 / 注册"}
              onPress={() => router.push(user ? "/account-settings" : "/login")}
            >
              <CachedImage
                source={user?.headImage ? { uri: user.headImage } : avatar}
                style={styles.avatar}
              />
            </Pressable>
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
          </View>
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
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="星钻余额，点击充值"
            onPress={openStarRecharge}
            style={styles.stat}
          >
            <Text style={styles.statValue}>{user?.starBalance ?? "--"}</Text>
            <View style={styles.statLabelRow}>
              <Text style={styles.statLabel}>星钻</Text>
              {/* <Text style={styles.rechargeHint}>充值 ›</Text> */}
            </View>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="关注列表"
            onPress={() => openRelations("following")}
            style={styles.stat}
          >
            <Text style={styles.statValue}>
              {followCount?.followCount ?? "--"}
            </Text>
            <Text style={styles.statLabel}>关注</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="粉丝列表"
            onPress={() => openRelations("fans")}
            style={styles.stat}
          >
            <Text style={styles.statValue}>
              {followCount?.fansCount ?? "--"}
            </Text>
            <Text style={styles.statLabel}>粉丝</Text>
          </Pressable>
        </View>
        <View style={styles.sectionCard}>
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
      <JoinQrCodeModal
        type={qrCodeModal}
        onClose={() => setQrCodeModal(null)}
      />
    </View>
  );
}

function JoinQrCodeModal({
  type,
  onClose,
}: {
  type: QrCodeModalType | null;
  onClose: () => void;
}) {
  const isClub = type === "club";

  return (
    <Modal
      animationType="fade"
      transparent
      visible={type !== null}
      onRequestClose={onClose}
    >
      <View style={styles.qrModalBackdrop}>
        <Pressable
          accessibilityLabel="关闭二维码弹窗"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View accessibilityViewIsModal style={styles.qrModalCard}>
          <View style={styles.qrModalHeader}>
            <Text style={styles.qrModalTitle}>
              {isClub ? "俱乐部入驻" : "成为陪玩师"}
            </Text>
            <Pressable
              accessibilityLabel="关闭"
              hitSlop={10}
              onPress={onClose}
              style={styles.qrModalClose}
            >
              <Dismiss24Regular color="#999999" height={20} width={20} />
            </Pressable>
          </View>
          <Image
            accessibilityLabel={
              isClub ? "俱乐部入驻二维码" : "成为陪玩师二维码"
            }
            contentFit="contain"
            source={isClub ? clubEntryQrCode : companionEntryQrCode}
            style={styles.qrCode}
          />
          <Text style={styles.qrModalHint}>
            {isClub
              ? "扫码联系工作人员，申请俱乐部入驻"
              : "扫码联系工作人员，申请成为陪玩师"}
          </Text>
        </View>
      </View>
    </Modal>
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
    color: "#0A0A0A",
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "500",
  },
  statLabel: {
    color: "#999",
    fontSize: 11,
    lineHeight: 16,
  },
  statLabelRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  rechargeHint: {
    fontFamily: DOUYIN_SANS,
    color: "#FF3158",
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
  dialogBackdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  logoutDialog: {
    width: "100%",
    borderRadius: 12,
    backgroundColor: "#FFF",
    padding: 24,
    alignItems: "center",
  },
  logoutMark: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFF1F3",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  logoutMarkText: { color: "#FF1F4C", fontSize: 22, fontWeight: "700" },
  logoutTitle: {
    color: "#0A0A0A",
    fontFamily: DOUYIN_SANS,
    fontSize: 17,
    fontWeight: "600",
  },
  logoutMessage: {
    color: "#666",
    fontFamily: DOUYIN_SANS,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
    textAlign: "center",
  },
  logoutActions: {
    width: "100%",
    flexDirection: "row",
    gap: 10,
    marginTop: 22,
  },
  logoutCancel: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    backgroundColor: "#F7F7F7",
    alignItems: "center",
    justifyContent: "center",
  },
  logoutCancelText: { color: "#666", fontFamily: DOUYIN_SANS, fontSize: 15 },
  logoutConfirm: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    backgroundColor: "#FF1F4C",
    alignItems: "center",
    justifyContent: "center",
  },
  logoutConfirmText: { color: "#FFF", fontFamily: DOUYIN_SANS, fontSize: 15 },
  qrModalBackdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  qrModalCard: {
    width: "100%",
    maxWidth: 327,
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 24,
    backgroundColor: "#FFF",
  },
  qrModalHeader: {
    width: "100%",
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  qrModalTitle: {
    color: "#0A0A0A",
    fontFamily: DOUYIN_SANS,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "600",
  },
  qrModalClose: {
    position: "absolute",
    right: 0,
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  qrCode: {
    width: 160,
    height: 160,
    marginTop: 20,
  },
  qrModalHint: {
    marginTop: 16,
    color: "#666",
    fontFamily: DOUYIN_SANS,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
});
