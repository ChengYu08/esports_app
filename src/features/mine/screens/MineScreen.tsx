import { CachedImage } from "@/shared/ui/CachedImage";
import { useAuthStore } from "@esports/auth";
import {
  Apps24Regular,
  ChevronRight16Regular,
  Dismiss24Regular,
  Headset24Regular,
  Settings24Regular,
} from "@fluentui/react-native-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import { type ReactNode, useCallback, useMemo, useState } from "react";
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
import { fetchStarBalance } from "@/features/mine/api/companion-order.api";
import { useUserFollowCount } from "@/features/mine/hooks/use-user-follow";
import { useCustomerServiceEntry } from "@/features/mine/hooks/use-customer-service-entry";
import {
  resolveVoiceRoomId,
  voiceRoomApi,
} from "@/features/voice-room/voice-room.api";
import { requireLogin } from "@/shared/navigation/require-login";
import { DOUYIN_SANS } from "@/shared/theme/typography";

const avatar = require("../../../../assets/mine/figma/mine-avatar.png");
const clubFlag = require("../../../../assets/mine/figma/mine-club-flag.svg");
const maleIcon = require("../../../../assets/home/club-detail/male.svg");
const femaleIcon = require("../../../../assets/home/club-detail/female.svg");
const companionEntryQrCode = require("../../../../assets/coms/qrcode-pws.png");
const menuRoomIcon = require("../../../../assets/mine/figma/mine-menu-room.svg");
const menuCompanionIcon = require("../../../../assets/mine/figma/mine-menu-companion.svg");

type MenuItem = {
  key: string;
  icon: ReactNode;
  onPress: () => void;
  title: string;
  disabled?: boolean;
  busy?: boolean;
};

/** 由出生日期计算周岁；无法解析或年龄非法时返回 null。 */
function calcAge(birth?: string): number | null {
  if (!birth) return null;
  const trimmed = birth.trim();
  let date: Date | null = null;
  const dateMatch = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (dateMatch) {
    const parsed = new Date(
      Number(dateMatch[1]),
      Number(dateMatch[2]) - 1,
      Number(dateMatch[3]),
    );
    if (!Number.isNaN(parsed.getTime())) date = parsed;
  } else {
    const timestamp = Number(trimmed);
    if (Number.isFinite(timestamp) && timestamp > 0) {
      const parsed = new Date(timestamp * (timestamp < 1e12 ? 1000 : 1));
      if (!Number.isNaN(parsed.getTime())) date = parsed;
    }
  }
  if (!date) return null;
  const now = new Date();
  let age = now.getFullYear() - date.getFullYear();
  const monthDiff = now.getMonth() - date.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < date.getDate())) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}

export default function MineScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);
  const isCompanion = useAuthStore((state) => state.isCompanion);
  // 只解构 refetch 函数作为 focus effect 的稳定依赖；整个 query result
  // 每次渲染都会生成新引用，导致接口被重复触发。
  const { data: followCount, refetch: refetchFollowCount } = useUserFollowCount(
    user?.id,
  );
  const [qrCodeVisible, setQrCodeVisible] = useState(false);
  const [openingVoiceRoom, setOpeningVoiceRoom] = useState(false);
  const { entering: enteringCustomerService, openCustomerService } = useCustomerServiceEntry();

  const userId = user?.id;

  useFocusEffect(
    useCallback(() => {
      void refetchFollowCount();
      if (!accessToken || !userId) return;
      const requestedUserId = userId;
      // 资料走 login/info：昵称、头像、性别、生日、俱乐部等在资料编辑后回首页保持最新。
      void clientAuthApi
        .fetchCurrentUser(accessToken)
        .then((profile) => {
          useAuthStore.setState((state) => {
            // 切换账号后丢弃旧账号的迟到结果，防止覆盖新用户。
            if (!state.user || state.user.id !== String(profile.id))
              return state;
            const nextUser = {
              ...state.user,
              nickname: profile.nickname ?? state.user.nickname,
              headImage: profile.headImage || state.user.headImage,
              gender: profile.gender ?? state.user.gender,
              birth: profile.birth ?? state.user.birth,
              signature: profile.signature ?? state.user.signature,
              isRealName: profile.isRealName ?? state.user.isRealName,
              realName: profile.realName ?? state.user.realName,
              clubInfo: profile.clubInfo ?? state.user.clubInfo,
              positions: profile.positions ?? state.user.positions,
            };
            const unchanged =
              JSON.stringify(state.user) === JSON.stringify(nextUser);
            return unchanged ? state : { user: nextUser };
          });
        })
        .catch(() => undefined);
      // 余额单独走 pay/starBalance，与充值模块同源，不依赖 login/info 的余额字段。
      void fetchStarBalance(accessToken)
        .then((balance) => {
          useAuthStore.setState((state) => {
            if (!state.user || state.user.id !== requestedUserId) return state;
            const current = Number(state.user.starBalance);
            const unchanged =
              state.user.starBalance !== undefined && current === balance;
            return unchanged
              ? state
              : { user: { ...state.user, starBalance: balance } };
          });
        })
        .catch(() => undefined);
    }, [refetchFollowCount, accessToken, userId]),
  );

  const displayName = useMemo(
    () =>
      user?.nickname ||
      (user?.phone
        ? `${user.phone.slice(0, 3)}****${user.phone.slice(-4)}`
        : "登录 / 注册"),
    [user],
  );

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
  const openHomepage = () => {
    if (!requireLogin()) return;
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
  };

  const age = calcAge(user?.birth);
  const genderIcon =
    user?.gender === 1 ? maleIcon : user?.gender === 2 ? femaleIcon : null;
  const showBadge = Boolean(genderIcon) || age !== null;

  const menuItems = [
    {
      key: "room",
      title: openingVoiceRoom ? "正在进入房间" : "我的房间",
      icon: <Image source={menuRoomIcon} contentFit="contain" style={styles.menuIcon} />,
      onPress: () => void openMyRoom(),
    },
    {
      key: "companion",
      title: isCompanion ? "陪玩管理" : "成为陪玩师",
      icon: <Image source={menuCompanionIcon} contentFit="contain" style={styles.menuIcon} />,
      onPress: () =>
        isCompanion
          ? router.push("/companion-dashboard")
          : setQrCodeVisible(true),
    },
    {
      key: "settings",
      title: "基础设置",
      icon: <Apps24Regular color="#1A1A1A" width={18} height={18} />,
      onPress: () => router.push("/basic-settings"),
    },
    {
      key: "customer-service",
      title: "在线客服",
      icon: <Headset24Regular color="#1A1A1A" width={18} height={18} />,
      onPress: openCustomerService,
      disabled: enteringCustomerService,
      busy: enteringCustomerService,
    },
  ] satisfies readonly MenuItem[];

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom, 16) + 60,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <LinearGradient
            pointerEvents="none"
            colors={["#FCEFF0", "#EDF2FA", "#F5F6F7"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              styles.toolbar,
              { paddingTop: insets.top, height: 44 + insets.top },
            ]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="基础设置"
              hitSlop={8}
              onPress={() => router.push("/basic-settings")}
              style={styles.settingsButton}
            >
              <Settings24Regular color="#333333" width={24} height={24} style={styles.settingsIcon} />
            </Pressable>
          </View>
          <View style={styles.profile}>
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
              <View style={styles.nameLine}>
                <Text
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  style={styles.name}
                >
                  {displayName}
                </Text>
                {showBadge ? (
                  <View style={styles.badge}>
                    {genderIcon ? (
                      <Image source={genderIcon} style={styles.genderIcon} />
                    ) : null}
                    {age !== null ? (
                      <Text style={styles.ageText}>{age}岁</Text>
                    ) : null}
                  </View>
                ) : null}
              </View>
              {user?.clubInfo ? (
                <View style={styles.clubLine}>
                  <Image source={clubFlag} style={styles.clubFlag} />
                  <Text
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={styles.clubName}
                  >
                    {user.clubInfo.clubName}
                  </Text>
                </View>
              ) : null}
            </View>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="个人主页"
              onPress={openHomepage}
              style={styles.homepageCapsule}
            >
              <Text style={styles.homepageText}>个人主页</Text>
              <ChevronRight16Regular color="#FFFFFF" width={12} height={12} />
            </Pressable>
          </View>
          <View style={styles.stats}>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="星钻余额，点击充值"
              onPress={openStarRecharge}
              style={styles.stat}
            >
              <Text style={styles.statValue}>{user?.starBalance ?? "--"}</Text>
              <Text style={styles.statLabel}>星钻</Text>
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
        </View>
        <View style={styles.menuCard}>
          {menuItems.map(({ key, ...item }) => (
            <MenuRow key={key} {...item} />
          ))}
        </View>
      </ScrollView>
      <CompanionQrModal
        visible={qrCodeVisible}
        onClose={() => setQrCodeVisible(false)}
      />
    </View>
  );
}

function CompanionQrModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
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
            <Text style={styles.qrModalTitle}>成为陪玩师</Text>
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
            accessibilityLabel="成为陪玩师二维码"
            contentFit="contain"
            source={companionEntryQrCode}
            style={styles.qrCode}
          />
          <Text style={styles.qrModalHint}>
            扫码联系工作人员，申请成为陪玩师
          </Text>
        </View>
      </View>
    </Modal>
  );
}

function MenuRow({ icon, title, onPress, disabled, busy }: MenuItem) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, busy }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.menuRow, pressed && styles.menuPressed]}
    >
      {icon}
      <Text style={styles.menuTitle}>{title}</Text>
      <ChevronRight16Regular color="#B6B6B6" width={14} height={14} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F5F6F7" },
  hero: { backgroundColor: "#F5F6F7" },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: 16,
  },
  settingsButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  settingsIcon: { width: 24, height: 24 },
  profile: {
    minHeight: 76,
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  profileCopy: { flex: 1, gap: 6 },
  nameLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: {
    flexShrink: 1,
    fontFamily: DOUYIN_SANS,
    color: "#0A0A0A",
    fontSize: 18,
    lineHeight: 26,
    fontWeight: "600",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    height: 22,
    paddingHorizontal: 7,
    borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.75)",
  },
  genderIcon: { width: 12, height: 12 },
  ageText: {
    fontFamily: DOUYIN_SANS,
    color: "#666666",
    fontSize: 12,
    lineHeight: 18,
  },
  clubLine: { flexDirection: "row", alignItems: "center", gap: 4 },
  clubFlag: { width: 12, height: 12 },
  clubName: {
    flexShrink: 1,
    fontFamily: DOUYIN_SANS,
    color: "#999999",
    fontSize: 12,
    lineHeight: 18,
  },
  homepageCapsule: {
    position: "absolute",
    right: 0,
    bottom: 10,
    width: 88,
    height: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    borderTopLeftRadius: 24,
    borderBottomLeftRadius: 24,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    overflow: "hidden",
    backgroundColor: "rgba(0, 0, 0, 0.25)",
  },
  homepageText: {
    color: "#FFFFFF",
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "500",
    includeFontPadding: false,
    textAlign: "center",
    textAlignVertical: "center",
  },
  stats: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
  },
  stat: { flex: 1, alignItems: "center", gap: 3 },
  statValue: {
    color: "#0A0A0A",
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
  },
  statLabel: {
    color: "#999999",
    fontSize: 12,
    lineHeight: 18,
  },
  menuCard: {
    marginHorizontal: 12,
    marginTop: 2,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },
  menuRow: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  menuPressed: { backgroundColor: "#F5F6F7" },
  menuIcon: { width: 18, height: 18 },
  menuTitle: {
    flex: 1,
    fontFamily: DOUYIN_SANS,
    color: "#1A1A1A",
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "400",
  },
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
