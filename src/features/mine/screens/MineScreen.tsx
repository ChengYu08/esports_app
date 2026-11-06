import { CachedImage } from "@/shared/ui/CachedImage";
import { useAuthStore } from "@esports/auth";
import {
  ChevronRight16Regular,
  ChevronRight20Regular,
  Dismiss24Regular,
} from "@fluentui/react-native-icons";
import { Image, type ImageSource } from "expo-image";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as MediaLibrary from "expo-media-library";
import { router, useFocusEffect } from "expo-router";
import { type ReactNode, useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { showToast } from "@/shared/ui/app-toast";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { logger } from "@/core/logging/logger";
import { clientAuthApi } from "@/features/auth/client-auth.api";
import { fetchStarBalance } from "@/features/mine/api/companion-order.api";
import { resolveMineMenuKeys, type MineMenuKey } from "@/features/mine/mine-menu";
import { calculateAge } from "@/features/mine/profile-utils";
import { useCustomerServiceEntry } from "@/features/mine/hooks/use-customer-service-entry";
import { useUserFollowCount } from "@/features/mine/hooks/use-user-follow";
import {
  resolveVoiceRoomId,
  voiceRoomApi,
} from "@/features/voice-room/voice-room.api";
import { navigateToVoiceRoom } from "@/features/voice-room/navigate-voice-room";
import { requireLogin } from "@/shared/navigation/require-login";

const avatar = require("../../../../assets/mine/mine-avatar.png");
const heroBackground = require("../../../../assets/mine/mine-hero-bg.webp");
const menuClubIcon = require("../../../../assets/svgs/mine-menu-club.svg");
const settingsIcon = require("../../../../assets/svgs/mine-settings.svg");
const maleIcon = require("../../../../assets/svgs/gender-male.svg");
const femaleIcon = require("../../../../assets/svgs/gender-female.svg");
const companionEntryQrCode = require("../../../../assets/coms/qrcode-pws.webp");
const clubEntryQrCode = require("../../../../assets/coms/qrcode-jlb.webp");
const menuRoomIcon = require("../../../../assets/svgs/mine-menu-room.svg");
const menuCompanionIcon = require("../../../../assets/svgs/mine-menu-companion.svg");
const menuSettingsIcon = require("../../../../assets/svgs/mine-menu-settings.svg");
const menuServiceIcon = require("../../../../assets/svgs/mine-menu-service.svg");
const menuOrderIcon = require("../../../../assets/svgs/mine-menu-order.svg");

type MenuItem = {
  key: string;
  icon: ReactNode;
  onPress: () => void;
  title: string;
  disabled?: boolean;
  busy?: boolean;
};

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
  const [clubQrCodeVisible, setClubQrCodeVisible] = useState(false);
  const [clubAdminModalVisible, setClubAdminModalVisible] = useState(false);
  const [openingVoiceRoom, setOpeningVoiceRoom] = useState(false);
  const { entering: enteringCustomerService, openCustomerService } =
    useCustomerServiceEntry();

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
              sidebarMenus: profile.sidebarMenus ?? state.user.sidebarMenus,
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
    router.push("/my-diamonds");
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
      navigateToVoiceRoom({ id: roomId });
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "进入语聊房失败，请稍后重试",
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

  const genderIcon =
    user?.gender === 1 ? maleIcon : user?.gender === 2 ? femaleIcon : null;
  // 年龄由生日推算，缺失或非法时不展示
  const age = calculateAge(user?.birth ?? "");
  const genderColor = user?.gender === 1 ? "#3DA5FF" : "#FF42A1";

  // 已加入俱乐部（login/info 返回 clubInfo）的用户不再展示入驻入口。
  const hasClub = Boolean(user?.clubInfo?.id);

  // 功能入口按服务端 sidebarMenus 下发顺序动态组装（与 PC 端口径一致），
  // 服务端未下发时按本地身份兜底推导；我的房间/基础设置/在线客服为固定项。
  const menuIcon = (source: number) => (
    <Image source={source} contentFit="contain" style={styles.menuIcon} />
  );
  const dynamicMenuItem = (key: MineMenuKey): MenuItem => {
    switch (key) {
      case "CLUB_JOIN":
        return {
          key,
          title: "俱乐部入驻",
          icon: menuIcon(menuClubIcon),
          onPress: () => setClubQrCodeVisible(true),
        };
      case "BECOME_PLAYMATE":
        return {
          key,
          title: "成为陪玩",
          icon: menuIcon(menuCompanionIcon),
          onPress: () => setQrCodeVisible(true),
        };
      case "PLAYMATE_MANAGE":
        return {
          key,
          title: "陪玩中心",
          icon: menuIcon(menuCompanionIcon),
          onPress: () => router.push("/companion-dashboard"),
        };
      case "CLUB_ADMIN":
        return {
          key,
          title: "俱乐部后台",
          // 设计稿中俱乐部后台与在线客服共用同一图标
          icon: menuIcon(menuServiceIcon),
          onPress: () => setClubAdminModalVisible(true),
        };
      case "MY_ORDERS":
        return {
          key,
          title: "我的订单",
          icon: menuIcon(menuOrderIcon),
          onPress: () => router.push("/order"),
        };
    }
  };

  const menuItems: MenuItem[] = [
    {
      key: "room",
      title: openingVoiceRoom ? "正在进入房间" : "我的房间",
      icon: menuIcon(menuRoomIcon),
      onPress: () => void openMyRoom(),
    },
    ...resolveMineMenuKeys(user?.sidebarMenus, { hasClub, isCompanion }).map(
      dynamicMenuItem,
    ),
    {
      key: "settings",
      title: "基础设置",
      icon: menuIcon(menuSettingsIcon),
      onPress: () => router.push("/basic-settings"),
    },
    {
      key: "customer-service",
      title: "在线客服",
      icon: menuIcon(menuServiceIcon),
      onPress: openCustomerService,
      disabled: enteringCustomerService,
      busy: enteringCustomerService,
    },
  ];

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom, 16) + 60,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Image
            pointerEvents="none"
            source={heroBackground}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
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
              style={styles.toolbarButton}
            >
              <Image source={settingsIcon} style={styles.toolbarIcon} />
            </Pressable>
          </View>
          <View style={styles.profile}>
            {/* 头像 + 昵称 + 签名整体可点，进入编辑资料 */}
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={user ? "编辑资料" : "登录 / 注册"}
              onPress={() => router.push(user ? "/edit-profile" : "/login")}
              style={styles.profileMain}
            >
              <CachedImage
                source={user?.headImage ? { uri: user.headImage } : avatar}
                style={styles.avatar}
              />
              <View style={styles.profileCopy}>
                <View style={styles.nameLine}>
                  <Text
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={styles.name}
                  >
                    {displayName}
                  </Text>
                  {genderIcon ? (
                    <View style={styles.badge}>
                      <Image source={genderIcon} style={styles.genderIcon} />
                      {age ? (
                        <Text
                          allowFontScaling={false}
                          style={[styles.ageText, { color: genderColor }]}
                        >
                          {age}
                        </Text>
                      ) : null}
                    </View>
                  ) : null}
                </View>
                <Text
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  style={styles.signatureText}
                >
                  {user?.signature || "保持一点神秘感..."}
                </Text>
              </View>
            </Pressable>
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
              accessibilityLabel="钻石余额，点击充值"
              onPress={openStarRecharge}
              style={styles.stat}
            >
              <Text style={styles.statValue}>{user?.starBalance ?? "--"}</Text>
              <Text style={styles.statLabel}>钻石</Text>
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
      <ClubQrModal
        visible={clubQrCodeVisible}
        onClose={() => setClubQrCodeVisible(false)}
      />
      <ClubAdminNoticeModal
        visible={clubAdminModalVisible}
        onClose={() => setClubAdminModalVisible(false)}
      />
    </View>
  );
}

/** 保存二维码原图到系统相册：直接从图片资源取像素，不截屏，避免弹层内截图失败或糊图 */
function useSaveQrCode(source: ImageSource) {
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (saving) {
      return;
    }
    setSaving(true);
    try {
      // Android 10 起写入相册不需要存储权限，只有 iOS 和更老系统要申请
      if (Platform.OS !== "android" || Number(Platform.Version) < 30) {
        const permission = await MediaLibrary.requestPermissionsAsync(true);
        if (!permission.granted) {
          showToast("请在系统设置中允许盼之电竞访问相册");
          return;
        }
      }
      const image = await Image.loadAsync(source);
      const rendered = await ImageManipulator.manipulate(image).renderAsync();
      const { uri } = await rendered.saveAsync({ format: SaveFormat.PNG });
      await MediaLibrary.Asset.create(uri);
      showToast("已保存到相册");
    } catch (error) {
      logger.warn("save qrcode failed", {
        reason: error instanceof Error ? error.message : String(error),
      });
      showToast("保存失败，请稍后重试");
    } finally {
      setSaving(false);
    }
  };

  return { saving, save };
}

function ClubQrModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { saving, save } = useSaveQrCode(clubEntryQrCode);

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
            <Text style={styles.qrModalTitle}>俱乐部入驻</Text>
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
            accessibilityLabel="俱乐部入驻二维码"
            contentFit="contain"
            source={clubEntryQrCode}
            style={styles.qrCode}
          />
          <Text style={styles.qrModalHint}>
            扫码联系工作人员，申请俱乐部入驻
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="保存二维码"
            accessibilityState={{ disabled: saving, busy: saving }}
            disabled={saving}
            onPress={save}
            style={({ pressed }) => [
              styles.qrSaveButton,
              styles.qrSaveButtonWide,
              pressed && styles.buttonPressed,
              saving && styles.qrSaveButtonDisabled,
            ]}
          >
            {saving ? (
              <ActivityIndicator color="#FE1F4C" size="small" />
            ) : (
              <Text style={styles.qrSaveText}>保存二维码</Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function CompanionQrModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { saving, save } = useSaveQrCode(companionEntryQrCode);

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.qrModalBackdrop}>
        <Pressable
          accessibilityLabel="关闭成为陪玩师弹窗"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        {/* 设计稿 571-59485：295 宽白卡，标题+说明+120 二维码+单个保存按钮，无关闭叉号 */}
        <View accessibilityViewIsModal style={styles.companionQrCard}>
          <View style={styles.companionQrContent}>
            <Text style={styles.companionQrTitle}>成为陪玩师</Text>
            <Text style={styles.companionQrBody}>
              加入盼之电竞自营俱乐部，赚取丰厚报酬
            </Text>
            <View style={styles.companionQrImageWrap}>
              <Image
                accessibilityLabel="成为陪玩师二维码"
                contentFit="contain"
                source={companionEntryQrCode}
                style={styles.companionQrCode}
              />
            </View>
          </View>
          <View style={styles.companionQrActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="保存二维码"
              accessibilityState={{ disabled: saving, busy: saving }}
              disabled={saving}
              onPress={save}
              style={({ pressed }) => [
                styles.qrSaveButton,
                pressed && styles.buttonPressed,
                saving && styles.qrSaveButtonDisabled,
              ]}
            >
              {saving ? (
                <ActivityIndicator color="#FE1F4C" size="small" />
              ) : (
                <Text style={styles.qrSaveText}>保存二维码</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ClubAdminNoticeModal({
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
          accessibilityLabel="关闭俱乐部后台提示弹窗"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View accessibilityViewIsModal style={styles.qrModalCard}>
          <View style={styles.qrModalHeader}>
            <Text style={styles.qrModalTitle}>俱乐部后台</Text>
            <Pressable
              accessibilityLabel="关闭"
              hitSlop={10}
              onPress={onClose}
              style={styles.qrModalClose}
            >
              <Dismiss24Regular color="#999999" height={20} width={20} />
            </Pressable>
          </View>
          <Text style={styles.clubAdminNoticeText}>
            俱乐部后台请在 PC 端操作
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [
              styles.clubAdminConfirmButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.clubAdminConfirmText}>我知道了</Text>
          </Pressable>
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
      <ChevronRight20Regular color="#979799" width={20} height={20} />
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
    gap: 12,
    // 设计稿 nav/right：右内边距 12
    paddingHorizontal: 12,
  },
  toolbarButton: {
    width: 32,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  toolbarIcon: { width: 24, height: 24 },
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
  profileMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  profileCopy: { flex: 1, gap: 4, paddingRight: 96 },
  nameLine: { flexDirection: "row", alignItems: "center", gap: 4 },
  name: {
    flexShrink: 1,
    color: "#0D0D0F",
    fontSize: 18,
    lineHeight: 26,
    fontWeight: "600",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    height: 18,
    paddingHorizontal: 6,
    borderRadius: 9,
    backgroundColor: "#FFFFFF",
  },
  genderIcon: { width: 12, height: 12 },
  ageText: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: 500,
    includeFontPadding: false,
  },
  signatureText: {
    flexShrink: 1,
    color: "#979799",
    fontSize: 12,
    lineHeight: 18,
  },
  homepageCapsule: {
    position: "absolute",
    right: 0,
    // 与头像行（56 高）垂直居中：profile 顶部对齐后头像中心在 31，胶囊 32 高 → top 15
    top: 15,
    width: 84,
    height: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    overflow: "hidden",
    paddingLeft: 12,
    paddingRight: 4,
    backgroundColor: "rgba(0, 0, 0, 0.25)",
  },
  homepageText: {
    color: "#FFFFFF",
    fontSize: 12,
    lineHeight: 18,
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
    paddingBottom: 8,
  },
  stat: { flex: 1, alignItems: "center", gap: 3 },
  statValue: {
    color: "#0D0D0F",
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
  },
  statLabel: {
    color: "#656566",
    fontSize: 12,
    lineHeight: 18,
  },
  menuCard: {
    marginHorizontal: 12,
    marginTop: 0,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },
  menuRow: {
    height: 54,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  menuPressed: { backgroundColor: "#F5F6F7" },
  menuIcon: { width: 16, height: 16 },
  menuTitle: {
    flex: 1,
    color: "#0A0A0A",
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
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
  // 成为陪玩师弹窗（设计稿 571-59485）：295 宽白卡，内容 16/16/20，按钮区 4/16/16
  companionQrCard: {
    width: "100%",
    maxWidth: 295,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },
  companionQrContent: {
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 20,
    gap: 12,
  },
  companionQrTitle: {
    color: "#333333",
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
    textAlign: "center",
  },
  companionQrBody: {
    color: "#666666",
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
  },
  // 二维码容器：纯白底托住圆角图片，居中展示
  companionQrImageWrap: {
    width: 120,
    height: 120,
    alignSelf: "center",
    backgroundColor: "#FFFFFF",
  },
  companionQrCode: { width: 120, height: 120, borderRadius: 8 },
  companionQrActions: {
    paddingTop: 4,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  qrSaveButton: {
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#FE1F4C",
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
  },
  // 俱乐部入驻弹窗：按钮贴卡片底部通栏
  qrSaveButtonWide: { marginTop: 20, width: "100%" },
  qrSaveButtonDisabled: { opacity: 0.6 },
  qrSaveText: {
    color: "#FE1F4C",
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "600",
  },
  clubAdminNoticeText: {
    marginTop: 20,
    color: "#666",
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
  },
  clubAdminConfirmButton: {
    marginTop: 24,
    width: "100%",
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "#FE1F4C",
  },
  clubAdminConfirmText: {
    color: "#FFF",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  buttonPressed: { opacity: 0.82 },
});
