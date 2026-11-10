import { useAuthStore } from "@esports/auth";
import { Dismiss16Regular } from "@fluentui/react-native-icons";
import { useMutation, useQueries } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    InteractionManager,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
    useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fetchProfileGameDetail } from "@/features/mine/api/profile.api";
import type { ProfileSkillCard } from "@/features/mine/api/profile.types";
import { CompanionOrderSheet } from "@/features/mine/components/CompanionOrderSheet";
import { StarPaymentSheet } from "@/features/mine/components/StarPaymentSheet";
import { useProfileDetail } from "@/features/mine/hooks/use-profile-data";
import {
    useToggleUserFollow,
    useUserFollowState,
} from "@/features/mine/hooks/use-user-follow";
import { afterOrderPaidOpenChat } from "@/features/order/notify-order-paid";
import { invalidateOrderQueries } from "@/features/order/order-query";
import { requireLogin } from "@/shared/navigation/require-login";
import { useAppConfirm } from "@/shared/ui/app-confirm";
import { showToast } from "@/shared/ui/app-toast";
import { AppPrompt } from "@/shared/ui/AppPrompt";
import { BottomSheet } from "@/shared/ui/BottomSheet";
import { canKickVoiceRoomMember, getMemberAge } from "../member-profile";
import { voiceRoomApi } from "../voice-room.api";
import type { VoiceRoomDetail, VoiceRoomMember } from "../voice-room.types";

const defaultAvatar = require("../../../../assets/images/avatar_default.webp");
const femaleIcon = require("../../../../assets/svgs/gender-female.svg");
const maleIcon = require("../../../../assets/svgs/gender-male.svg");
const idIcon = require("../../../../assets/svgs/member-id.svg");
const diamondIcon = require("../../../../assets/message/order-assistant-coin-3f6fcf.webp");

type OrderTarget = {
  card: ProfileSkillCard;
  gameName: string;
  gameId: number;
};

type ServiceListItem = OrderTarget;

type Props = {
  visible: boolean;
  member: VoiceRoomMember | null;
  room: VoiceRoomDetail | null;
  roomId?: string;
  /** 非空时「主页」/「下单」入口拦截（活动需求进行中限制唯一下单链路），点击仅提示不跳转 */
  orderEntryBlockedText?: string;
  onClose: () => void;
  onMemberKicked: (userId: string) => void;
};

export function VoiceRoomMemberSheet({
  visible,
  member,
  room,
  roomId,
  orderEntryBlockedText,
  onClose,
  onMemberKicked,
}: Props) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const token = useAuthStore((state) => state.accessToken);
  const viewer = useAuthStore((state) => state.user);
  const viewerId = viewer?.id == null ? undefined : String(viewer.id);
  const isSelf = member?.userId === viewerId;
  const profileQuery = useProfileDetail(
    member ? { userId: member.userId } : null,
    visible,
  );
  const profile = profileQuery.data;
  const games = profile?.games ?? [];
  const clubId = profile?.clubId;
  const memberUserId = member?.userId;

  const gameDetailQueries = useQueries({
    queries: games.map((game) => ({
      queryKey: [
        "profile-game-detail",
        clubId == null ? "" : String(clubId),
        memberUserId ?? "",
        String(game.gameId),
      ],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        fetchProfileGameDetail(
          {
            clubId: String(clubId),
            userId: memberUserId as string,
            gameId: String(game.gameId),
          },
          signal,
        ),
      enabled:
        visible && Boolean(clubId) && Boolean(memberUserId) && games.length > 0,
    })),
  });

  const [orderTarget, setOrderTarget] = useState<OrderTarget | null>(null);
  // iOS：同一呈现链上同时挂两个原生 Modal，后挂的弹窗会因原生第二次 present 失败而卡死；
  // 下单/支付期间先收起成员弹窗（suspended），各自退场后再串行恢复
  const [suspended, setSuspended] = useState(false);
  const pendingOrderTargetRef = useRef<OrderTarget | null>(null);
  const promptPendingRef = useRef(false);
  // 去充值导航离开当前屏：跳过 iOS 成员弹窗恢复，避免恢复后盖住充值页
  const rechargeRestoreSkipRef = useRef(false);
  useEffect(() => {
    if (visible) return;
    // 宿主整体关闭成员弹窗（含支付成功后经 onClose 关闭）：清挂起态，下次打开回到初始
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSuspended(false);
    pendingOrderTargetRef.current = null;
    promptPendingRef.current = false;
    rechargeRestoreSkipRef.current = false;
  }, [visible]);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentOrder, setPaymentOrder] = useState<{
    orderId: number;
    total: number;
  } | null>(null);
  const [paymentSheetVisible, setPaymentSheetVisible] = useState(false);
  const [profileBlockHeight, setProfileBlockHeight] = useState(0);

  const followQuery = useUserFollowState(
    isSelf || !visible ? undefined : member?.userId,
  );
  const toggleFollow = useToggleUserFollow();
  const kickMember = useMutation({
    mutationFn: (params: {
      roomId: string;
      roomVersion: string | number;
      userId: string;
      token: string;
    }) =>
      voiceRoomApi.kickMember(
        params.roomId,
        params.roomVersion,
        params.userId,
        params.token,
      ),
    onSuccess: (_, params) => onMemberKicked(params.userId),
    onError: (error) => {
      void useAppConfirm.getState().confirm({
        title: "踢出失败",
        message: error.message || "请稍后重试",
      });
    },
  });

  const serviceItems: ServiceListItem[] = [];
  for (const query of gameDetailQueries) {
    const detail = query.data;
    if (!detail) continue;
    for (const card of detail.skillCards) {
      serviceItems.push({
        card,
        gameName: detail.gameName,
        gameId: detail.gameId,
      });
    }
  }

  if (!member) return null;

  const nickname = profile?.nickname || member.nickname;
  const avatar = (profile?.headImage || member.avatar)?.trim();
  const avatarSource = avatar
    ? { uri: avatar.startsWith("//") ? `https:${avatar}` : avatar }
    : defaultAvatar;
  const gender = profile?.sex ?? (isSelf ? viewer?.gender : undefined);
  const age = getMemberAge(profile?.birth);
  const signature =
    profile?.signature ||
    (isSelf ? viewer?.signature : "") ||
    "这个人很神秘，还没有填写简介";
  const canKick =
    Boolean(roomId && token) &&
    canKickVoiceRoomMember(room, viewerId, member.userId);
  const followed = Boolean(followQuery.data?.followed);
  const busy = kickMember.isPending || toggleFollow.isPending;

  function confirmKick() {
    if (!canKick || !member || !room || !roomId || !token || busy) return;
    const params = {
      roomId,
      roomVersion: room.roomVersion,
      userId: member.userId,
      token,
    };
    void (async () => {
      const confirmed = await useAppConfirm.getState().confirm({
        title: "踢出用户",
        message: `确定将“${nickname}”踢出开黑房？`,
        cancelText: "取消",
        confirmText: "踢出",
      });
      if (confirmed) kickMember.mutate(params);
    })();
  }

  async function handleFollow() {
    if (!member || !token || !viewerId || isSelf || busy) return;
    if (!followQuery.data) {
      void followQuery.refetch();
      return;
    }
    try {
      const state = await toggleFollow.mutateAsync({
        followUserId: member.userId,
        currentlyFollowed: followed,
        token,
        viewerUserId: viewerId,
      });
      showToast(state.followed ? "关注成功" : "已取消关注");
    } catch (error) {
      void useAppConfirm.getState().confirm({
        title: "操作失败",
        message: error instanceof Error ? error.message : "请稍后重试",
      });
    }
  }

  function handleOrder(item: ServiceListItem) {
    if (orderEntryBlockedText) {
      showToast(orderEntryBlockedText);
      return;
    }
    if (!requireLogin() || !profile) return;
    if (Platform.OS === "ios") {
      // 先收成员弹窗，退场完成后由 onExited 挂下单弹窗
      pendingOrderTargetRef.current = item;
      setSuspended(true);
      return;
    }
    setOrderTarget(item);
  }

  // 弹层最高占屏 85%；关闭 / 头像资料 / 底栏固定，仅服务列表滚动
  const sheetMaxHeight = height * 0.85;
  const serviceListGap = 16;
  // 无列表时资料区与底栏间距 24；有列表时列表与底栏间距 16
  const actionsTopGap = serviceItems.length > 0 ? serviceListGap : 24;
  const actionsBlockHeight = actionsTopGap + 44 + insets.bottom + 16;
  const scrollMaxHeight = Math.max(
    80,
    sheetMaxHeight - profileBlockHeight - serviceListGap - actionsBlockHeight,
  );

  return (
    <>
      <BottomSheet
        visible={visible && !suspended}
        onClose={onClose}
        onExited={() => {
          // iOS：成员弹窗退场完成后串行挂下单弹窗
          const pending = pendingOrderTargetRef.current;
          if (!pending) return;
          pendingOrderTargetRef.current = null;
          setOrderTarget(pending);
        }}
        contentStyle={styles.sheet}
        backdropStyle={styles.backdrop}
      >
        <View style={[styles.sheetInner, { maxHeight: sheetMaxHeight }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="关闭用户资料"
            onPress={onClose}
            hitSlop={8}
            style={styles.close}
          >
            <View style={styles.closeIcon}>
              <Dismiss16Regular color="#161823" width={16} height={16} />
            </View>
          </Pressable>

          <View
            style={styles.profileBlock}
            onLayout={(event) => {
              const next = event.nativeEvent.layout.height;
              setProfileBlockHeight((prev) =>
                Math.abs(prev - next) > 1 ? next : prev,
              );
            }}
          >
            <View style={styles.header}>
              <LinearGradient
                colors={["#FFEFF0", "#F5F4FF"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0.17 }}
                style={StyleSheet.absoluteFill}
              />
              <LinearGradient
                colors={["rgba(255,255,255,0)", "#FFFFFF"]}
                locations={[0.6, 1]}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.avatarShadow}>
                <Image
                  source={avatarSource}
                  contentFit="cover"
                  style={styles.avatar}
                  accessibilityLabel={`${nickname}的头像`}
                />
              </View>
            </View>

            <View style={styles.info}>
              <Text numberOfLines={2} style={styles.nickname}>
                {nickname}
              </Text>
              <View style={styles.meta}>
                {gender === 1 || gender === 2 || age ? (
                  <View style={styles.metaItem}>
                    {gender === 1 || gender === 2 ? (
                      <Image
                        source={gender === 2 ? femaleIcon : maleIcon}
                        style={styles.genderIcon}
                      />
                    ) : null}
                    {age ? (
                      <Text
                        style={[styles.age, gender === 2 && styles.femaleAge]}
                      >
                        {age}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
                <View
                  style={styles.metaItem}
                  accessibilityLabel={`用户 ID ${member.userId}`}
                >
                  <Image source={idIcon} style={styles.idIcon} />
                  <Text selectable style={styles.userId}>
                    {member.userId}
                  </Text>
                </View>
              </View>
              <Pressable
                disabled={!profileQuery.isError}
                accessibilityRole={profileQuery.isError ? "button" : undefined}
                onPress={() => void profileQuery.refetch()}
                style={styles.signatureArea}
              >
                <Text style={styles.signature}>
                  {profileQuery.isPending
                    ? "资料加载中…"
                    : profileQuery.isError && !profile
                      ? "资料加载失败，点击重试"
                      : signature}
                </Text>
              </Pressable>
            </View>
          </View>

          {serviceItems.length > 0 ? (
            <ScrollView
              bounces={false}
              showsVerticalScrollIndicator={false}
              style={[styles.scroll, { maxHeight: scrollMaxHeight }]}
              contentContainerStyle={styles.scrollContent}
            >
              <View style={styles.serviceList}>
                {serviceItems.map((item) => (
                  <MemberServiceCard
                    key={`${item.card.companionServiceId}-${item.card.gameLevelId}`}
                    item={item}
                    onOrder={handleOrder}
                  />
                ))}
              </View>
            </ScrollView>
          ) : null}

          <View
            style={[
              styles.actions,
              {
                paddingTop: actionsTopGap,
                paddingBottom: insets.bottom + 16,
              },
            ]}
          >
            {canKick ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="踢出用户"
                disabled={busy}
                onPress={confirmKick}
                style={[styles.button, busy && styles.disabled]}
              >
                {kickMember.isPending ? (
                  <ActivityIndicator color="#FE1F4C" />
                ) : (
                  <Text style={[styles.buttonText, styles.kickText]}>踢出</Text>
                )}
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="查看用户主页"
              disabled={busy}
              onPress={() => {
                // 活动需求进行中：主页内的技能卡下单入口被屏蔽，仅提示走「派单匹配中」
                if (orderEntryBlockedText) {
                  showToast(orderEntryBlockedText);
                  return;
                }
                onClose();
                router.push({
                  pathname: "/profile",
                  params: { userId: member.userId },
                });
              }}
              style={[styles.button, busy && styles.disabled]}
            >
              <Text style={styles.buttonText}>主页</Text>
            </Pressable>
            {!isSelf ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={followed ? "取消关注" : "关注用户"}
                disabled={!token || busy || followQuery.isFetching}
                onPress={() => void handleFollow()}
                style={[
                  styles.button,
                  styles.followButton,
                  followed && styles.followedButton,
                  (!token || busy || followQuery.isFetching) && styles.disabled,
                ]}
              >
                {toggleFollow.isPending || followQuery.isFetching ? (
                  <ActivityIndicator color={followed ? "#0A0A0A" : "#FFFFFF"} />
                ) : (
                  <Text
                    style={[
                      styles.buttonText,
                      styles.followText,
                      followed && styles.followedText,
                    ]}
                  >
                    {followQuery.isError && !followQuery.data
                      ? "重试"
                      : followed
                        ? "取关"
                        : "关注"}
                  </Text>
                )}
              </Pressable>
            ) : null}
          </View>
        </View>
      </BottomSheet>

      {orderTarget && profile ? (
        <CompanionOrderSheet
          card={orderTarget.card}
          profile={profile}
          gameName={orderTarget.gameName}
          context={{
            serviceUserId: profile.userId,
            clubId: profile.clubId,
            gameId: orderTarget.gameId,
            gameLevelId: orderTarget.card.gameLevelId,
            gameModeName: orderTarget.card.modeName,
            gameLevelName: orderTarget.card.levelName,
            buyerUserId: Number(viewer?.id) || 0,
          }}
          token={token}
          onClose={() => {
            setOrderTarget(null);
            if (Platform.OS === "ios") {
              // 下单弹窗卸载后的下一轮再恢复成员弹窗，避免与退场同帧竞争
              InteractionManager.runAfterInteractions(() => {
                if (promptPendingRef.current) return;
                setSuspended(false);
              });
            }
          }}
          onRealNameVerificationRequired={() => router.push("/account-settings")}
          onOrderCreated={(order) => {
            setOrderTarget(null);
            setPaymentError(null);
            setPaymentOrder(order);
            if (Platform.OS === "ios") {
              // 先卸载下单 Modal，下一轮再挂支付弹窗
              InteractionManager.runAfterInteractions(() => {
                setPaymentSheetVisible(true);
              });
              return;
            }
            setPaymentSheetVisible(true);
          }}
        />
      ) : null}
      {paymentOrder ? (
        <StarPaymentSheet
          order={paymentOrder}
          visible={paymentSheetVisible}
          token={token}
          onClose={() => {
            const orderId = paymentOrder.orderId;
            setPaymentSheetVisible(false);
            setPaymentOrder(null);
            invalidateOrderQueries(orderId);
            if (Platform.OS === "ios") {
              // 支付弹窗卸载后的下一轮再恢复成员弹窗；有错误提示待弹时先提示、确认后再恢复；
              // 去充值导航离开当前屏时跳过恢复，避免成员弹窗盖住充值页
              InteractionManager.runAfterInteractions(() => {
                if (promptPendingRef.current) return;
                if (rechargeRestoreSkipRef.current) return;
                setSuspended(false);
              });
            }
          }}
          onGoRecharge={() => {
            rechargeRestoreSkipRef.current = true;
          }}
          onPaid={() => {
            const paidOrderId = paymentOrder.orderId;
            // 开黑房场景优先用成员 id，避免 profile 查询态抖动导致跳过发消息
            const companionUserId = String(profile?.userId || member.userId);
            const chatTitle =
              profile?.nickname || nickname || member.nickname || "用户聊天";
            const chatAvatar = profile?.headImage || member.avatar;
            const chatClubId = profile?.clubId;
            const accessToken = useAuthStore.getState().accessToken;
            pendingOrderTargetRef.current = null;
            setPaymentSheetVisible(false);
            setPaymentOrder(null);
            setPaymentError(null);
            void invalidateOrderQueries(paidOrderId);
            void afterOrderPaidOpenChat({
              companionUserIds: [companionUserId],
              token: accessToken,
              chat: {
                id: companionUserId,
                title: chatTitle,
                avatar: chatAvatar || undefined,
                clubId: chatClubId ? String(chatClubId) : undefined,
              },
              beforeNavigate: onClose,
            });
          }}
          onPaymentFailed={(message) => {
            if (Platform.OS === "ios") {
              // 先收支付弹窗，卸载后的下一轮单独弹错误提示，确认后再恢复成员弹窗
              promptPendingRef.current = true;
              setPaymentSheetVisible(false);
              setPaymentOrder(null);
              InteractionManager.runAfterInteractions(() => {
                setPaymentError(message);
              });
              return;
            }
            setPaymentError(message);
          }}
        />
      ) : null}
      <AppPrompt
        visible={Boolean(paymentError)}
        title="支付失败"
        message={paymentError ?? ""}
        onConfirm={() => {
          setPaymentError(null);
          if (Platform.OS === "ios") {
            promptPendingRef.current = false;
            // 提示弹窗收起后的下一轮再恢复成员弹窗
            InteractionManager.runAfterInteractions(() => {
              setSuspended(false);
            });
          }
        }}
      />
    </>
  );
}

function MemberServiceCard({
  item,
  onOrder,
}: {
  item: ServiceListItem;
  onOrder: (item: ServiceListItem) => void;
}) {
  const { card, gameName } = item;
  return (
    <View style={styles.serviceCard}>
      <View style={styles.serviceCopy}>
        <Text numberOfLines={1} style={styles.serviceName}>
          {`${gameName}-${card.modeName}-${card.levelName}`}
        </Text>
        <View style={styles.serviceMeta}>
          <Text style={styles.price}>{card.price}</Text>
          <Image source={diamondIcon} style={styles.diamond} />
          <Text style={styles.metaText}>{`订单${card.orderCount}`}</Text>
          {card.goodRate !== null && card.goodRate !== undefined ? (
            <Text style={styles.metaText}>{`${card.goodRate}%好评`}</Text>
          ) : null}
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`下单 ${gameName} ${card.modeName} ${card.levelName}`}
        style={styles.orderButton}
        onPress={() => onOrder(item)}
      >
        <Text style={styles.orderText}>下单</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
  },
  sheetInner: {
    position: "relative",
    width: "100%",
  },
  backdrop: { backgroundColor: "transparent" },
  profileBlock: {
    width: "100%",
  },
  scroll: {
    flexGrow: 0,
    width: "100%",
    marginTop: 16,
  },
  scrollContent: {
    flexGrow: 0,
    paddingHorizontal: 16,
  },
  header: {
    height: 160,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 24,
  },
  avatarShadow: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 4,
    borderColor: "#FFFFFF",
    backgroundColor: "#ECEBEF",
    shadowColor: "#000000",
    shadowOffset: { width: -5, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 28,
    elevation: 5,
  },
  avatar: { width: 80, height: 80, borderRadius: 40 },
  close: {
    position: "absolute",
    right: 13,
    top: 12,
    zIndex: 2,
  },
  closeIcon: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
  },
  info: {
    width: "100%",
    paddingHorizontal: 16,
    alignItems: "center",
    gap: 8,
  },
  nickname: {
    color: "#161823",
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "500",
    textAlign: "center",
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    minHeight: 18,
  },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 2 },
  genderIcon: { width: 12, height: 12 },
  age: { color: "#808080", fontSize: 12, fontWeight: "500", lineHeight: 18 },
  femaleAge: { color: "#FF4D70" },
  idIcon: { width: 14, height: 14 },
  userId: { color: "#808080", fontSize: 12, lineHeight: 18 },
  signatureArea: {
    width: "100%",
  },
  signature: {
    color: "rgba(22,24,35,0.6)",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  serviceList: {
    width: "100%",
    gap: 8,
  },
  serviceCard: {
    minHeight: 67,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#F7F7F7",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  serviceCopy: { flex: 1, minWidth: 0, gap: 6 },
  serviceName: {
    color: "#0A0A0A",
    fontSize: 14,
    fontWeight: "400",
  },
  serviceMeta: { flexDirection: "row", alignItems: "center", gap: 7 },
  price: {
    color: "#FE1F4C",
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "600",
  },
  diamond: { width: 15, height: 12.8, borderRadius: 4 },
  metaText: {
    color: "#979799",
    fontSize: 11,
    lineHeight: 16,
  },
  orderButton: {
    flexShrink: 0,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#FE1F4C",
    alignItems: "center",
    justifyContent: "center",
  },
  orderText: {
    color: "#FFFFFF",
    fontSize: 12,
    lineHeight: 18,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
    paddingHorizontal: 16,
    backgroundColor: "#FFFFFF",
  },
  button: {
    flex: 1,
    minHeight: 44,
    paddingVertical: 11,
    borderRadius: 8,
    backgroundColor: "#F2F2F2",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "#0A0A0A",
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "500",
  },
  kickText: { color: "#FE1F4C" },
  followButton: { backgroundColor: "#FE1F4C" },
  followText: { color: "#FFFFFF" },
  followedButton: { backgroundColor: "#F2F2F2" },
  followedText: { color: "#0A0A0A" },
  disabled: { opacity: 0.55 },
});
