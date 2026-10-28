import {
  Star16Filled,
  Star16Regular,
} from "@fluentui/react-native-icons";
import { CachedImage } from "@/shared/ui/CachedImage";
import { useAuthStore } from "@esports/auth";
import {
  Edit24Regular,
} from "@fluentui/react-native-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import {
  Animated,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  getFirstProfileGameId,
  getProfileRouteParams,
} from "@/features/mine/api/profile.contract";
import type {
  ProfileDetail,
  ProfileGame,
  ProfileGameDetail,
  ProfileReview,
  ProfileSkillCard,
} from "@/features/mine/api/profile.types";
import {
  addToBlacklist,
  isUserBlacklisted,
  subscribeBlacklist,
} from "@/features/mine/blacklist";
import { CompanionOrderSheet } from "@/features/mine/components/CompanionOrderSheet";
import { ProfileActionsSheet } from "@/features/mine/components/ProfileActionsSheet";
import {
  ProfileGameSkeleton,
  ProfileSkeleton,
} from "@/features/mine/components/ProfileSkeleton";
import { StarPaymentSheet } from "@/features/mine/components/StarPaymentSheet";
import {
  useProfileDetail,
  useProfileGameDetail,
  useProfileReviews,
} from "@/features/mine/hooks/use-profile-data";
import {
  useToggleUserFollow,
  useUserFollowState,
} from "@/features/mine/hooks/use-user-follow";
import { createImagePreviewParams } from "@/features/mine/image-preview.params";
import { createProfileAvatarPreviewParams } from "@/features/mine/profile-avatar-preview";
import { createProfileChatParams } from "@/features/mine/profile-chat";
import { calculateAge } from "@/features/mine/profile-utils";
import { invalidateOrderQueries } from "@/features/order/order-query";
import { cancelOrder } from "@/features/order/order.api";
import { useVoicePlayer } from "@/shared/audio/use-voice-player";
import { VoicePlayButton } from "@/shared/audio/VoicePlayButton";
import { requireLogin } from "@/shared/navigation/require-login";
import { DOUYIN_SANS } from "@/shared/theme/typography";
import { AppPrompt } from "@/shared/ui/AppPrompt";
import { EmptyState } from "@/shared/ui/AsyncStates";
import Toast from "react-native-root-toast";

const fallbackAvatar = require("../../../../assets/mine/figma/mine-avatar.png");
const background = require("../../../../assets/mine/figma/profile-bg.png");
const maleIcon = require("../../../../assets/home/club-detail/male.svg");
const femaleIcon = require("../../../../assets/mine/figma/mine-female.svg");
const clubIcon = require("../../../../assets/mine/figma/mine-club-flag.svg");
const backIcon = require("../../../../assets/mine/figma/profile-back.svg");
const diamondIcon = require("../../../../assets/home/club-detail/icon-diamond.svg");
const idleStatusIcon = require("../../../../assets/home/club-detail/status-idle.svg");
const playingStatusIcon = require("../../../../assets/home/club-detail/status-playing.svg");
type ProfileTab = "技能" | "评价";
type ProfileListItem = { key: string; content: ReactElement };

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const route = useLocalSearchParams<{
    clubId?: string | string[];
    userId?: string | string[];
  }>();
  const routeParams = getProfileRouteParams(route);
  const isMine = !routeParams || String(user?.id ?? "") === routeParams.userId;
  const [tab, setTab] = useState<ProfileTab>("技能");
  const [coverHeight, setCoverHeight] = useState(0);
  const headerFade = useMemo(() => new Animated.Value(0), []);
  const [compactActive, setCompactActive] = useState(false);
  const [selectedGameId, setSelectedGameId] = useState("");
  const [orderCard, setOrderCard] = useState<ProfileSkillCard | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentOrder, setPaymentOrder] = useState<{
    orderId: number;
    total: number;
  } | null>(null);
  const [paymentSheetVisible, setPaymentSheetVisible] = useState(false);
  const [profileActionsVisible, setProfileActionsVisible] = useState(false);
  const [blacklistPromptVisible, setBlacklistPromptVisible] = useState(false);
  const [blacklistStatus, setBlacklistStatus] = useState({
    userId: "",
    isBlacklisted: false,
  });
  const [paymentCancelError, setPaymentCancelError] = useState<string | null>(
    null,
  );
  const paymentCancelingRef = useRef(false);
  const chatCheckPendingRef = useRef(false);
  const detailQuery = useProfileDetail(routeParams);
  const detail = detailQuery.data;
  const followStateQuery = useUserFollowState(
    !isMine && detail ? String(detail.userId) : undefined,
  );
  const followMutation = useToggleUserFollow();
  const firstGameId = getFirstProfileGameId(detail?.games ?? []);
  const activeGameId = detail?.games.some(
    (game) => String(game.gameId) === selectedGameId,
  )
    ? selectedGameId
    : firstGameId;

  const gameDetailQuery = useProfileGameDetail(
    routeParams && (detail?.clubId || routeParams.clubId) && activeGameId
      ? {
          clubId: String(detail?.clubId || routeParams.clubId),
          userId: routeParams.userId,
          gameId: activeGameId,
        }
      : null,
  );
  const reviewQuery = useProfileReviews(
    tab === "评价" && routeParams && activeGameId
      ? { gameId: activeGameId, companionUserId: routeParams.userId }
      : null,
  );
  const localProfile = useMemo(() => toLocalProfile(user), [user]);
  const profile = detail ?? localProfile;

  useEffect(() => {
    if (isMine || profile.userId <= 0) return;

    let active = true;
    const refreshBlacklistStatus = () => {
      void isUserBlacklisted(profile.userId)
        .then((isBlacklisted) => {
          if (active) {
            setBlacklistStatus({
              userId: String(profile.userId),
              isBlacklisted,
            });
          }
        })
        .catch(() => {
          if (active) {
            setBlacklistStatus({
              userId: String(profile.userId),
              isBlacklisted: false,
            });
          }
        });
    };

    refreshBlacklistStatus();
    const unsubscribe = subscribeBlacklist(refreshBlacklistStatus);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [isMine, profile.userId]);

  const gameDetail = gameDetailQuery.data;
  const games = detail?.games ?? [];
  const coverImageUrl = gameDetail?.backgroundUrl?.trim();
  const voicePlayer = useVoicePlayer();
  const stopVoice = voicePlayer.stop;
  const coverPreviewParams = coverImageUrl
    ? createImagePreviewParams([coverImageUrl], 0)
    : null;

  useEffect(() => {
    if (tab !== "技能") stopVoice();
  }, [tab, stopVoice]);
  const openProfileRelation = (type: "following" | "fans") => {
    if (profile.userId <= 0) return;
    router.push({
      pathname: "/profile-relations",
      params: {
        userId: String(profile.userId),
        type,
        ...(profile.clubId > 0
          ? { clubId: String(profile.clubId) }
          : routeParams?.clubId
            ? { clubId: routeParams.clubId }
            : {}),
      },
    });
  };
  const handleFollowPress = async () => {
    if (!requireLogin() || !detail || followMutation.isPending) return;
    const session = useAuthStore.getState();
    if (!session.accessToken || !session.user) return;

    try {
      const state = await followMutation.mutateAsync({
        followUserId: String(detail.userId),
        currentlyFollowed: followStateQuery.data?.followed ?? false,
        token: session.accessToken,
        viewerUserId: session.user.id,
      });
      Toast.show(state.followed ? "关注成功" : "已取消关注", {
        duration: Toast.durations.SHORT,
      });
    } catch (error) {
      Toast.show(error instanceof Error ? error.message : "操作失败", {
        duration: Toast.durations.SHORT,
      });
    }
  };

  const handleChatPress = async () => {
    if (!requireLogin() || chatCheckPendingRef.current) return;
    chatCheckPendingRef.current = true;

    try {
      if (await isUserBlacklisted(profile.userId)) {
        Toast.show("该用户已在黑名单中，无法发起聊天", {
          duration: Toast.durations.SHORT,
        });
        return;
      }

      router.push({
        pathname: "/chat/[id]",
        params: createProfileChatParams({
          userId: profile.userId,
          nickname: profile.nickname,
          headImage: profile.headImage,
          clubId: profile.clubId,
        }),
      });
    } catch {
      Toast.show("黑名单状态读取失败，请稍后重试", {
        duration: Toast.durations.SHORT,
      });
    } finally {
      chatCheckPendingRef.current = false;
    }
  };

  if (routeParams && detailQuery.isLoading) {
    return (
      <ProfileSkeleton
        topInset={insets.top}
        bottomInset={insets.bottom}
        isMine={isMine}
      />
    );
  }

  if (routeParams && (detailQuery.isError || !detail)) {
    return (
      <ProfileState
        text="个人主页加载失败"
        actionLabel="重试"
        onAction={() => void detailQuery.refetch()}
      />
    );
  }

  const tabsContent = (
    <View style={styles.tabs}>
      {(["技能", "评价"] as ProfileTab[]).map((item) => (
        <Pressable
          key={item}
          onPress={() => setTab(item)}
          style={styles.tabButton}
        >
          <Text
            style={[styles.tabText, tab === item && styles.tabTextActive]}
          >
            {item}
          </Text>
          {tab === item ? <View style={styles.tabIndicator} /> : null}
        </Pressable>
      ))}
    </View>
  );

  // 默认头部中的标签栏:紧凑头部淡入时反向淡出
  const tabsInverseFade = headerFade.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });

  const profileTabs = (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.tabsBar, { opacity: tabsInverseFade }]}
    >
      {tabsContent}
    </Animated.View>
  );

  const profileCover = (
    <View
      style={styles.cover}
      onLayout={(event) => {
        const height = event.nativeEvent.layout.height;
        if (Math.abs(height - coverHeight) > 1) setCoverHeight(height);
      }}
    >
      {coverPreviewParams ? (
        <Pressable
          accessibilityLabel="预览主页背景图"
          accessibilityRole="button"
          onPress={() =>
            router.push({
              pathname: "/image-preview",
              params: coverPreviewParams,
            })
          }
          style={StyleSheet.absoluteFill}
        >
          <Image
            source={{ uri: coverImageUrl }}
            contentFit="cover"
            style={StyleSheet.absoluteFill}
          />
        </Pressable>
      ) : (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Image
            source={background}
            contentFit="cover"
            style={StyleSheet.absoluteFill}
          />
        </View>
      )}
      <LinearGradient
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
        colors={["#3B79BA00", "#3B79BA", "#3B79BA"]}
        locations={[0, 0.6, 1]}
      />
      <LinearGradient
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
        colors={["rgba(0,0,0,0.2)", "rgba(0,0,0,0.8)"]}
      />
      <ProfileIdentity
        profile={profile}
        isBlacklisted={
          !isMine &&
          blacklistStatus.userId === String(profile.userId) &&
          blacklistStatus.isBlacklisted
        }
      />
      <View style={styles.headerStats}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`关注列表，${profile.followCount}人`}
          onPress={() => openProfileRelation("following")}
          style={styles.headerStat}
        >
          <Text style={styles.headerStatValue}>{profile.followCount}</Text>
          <Text style={styles.headerStatLabel}>关注</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`粉丝列表，${profile.fansCount}人`}
          onPress={() => openProfileRelation("fans")}
          style={styles.headerStat}
        >
          <Text style={styles.headerStatValue}>{profile.fansCount}</Text>
          <Text style={styles.headerStatLabel}>粉丝</Text>
        </Pressable>
      </View>
      <Text numberOfLines={2} ellipsizeMode="tail" style={styles.headerIntro}>
        {profile.signature || "暂无个人简介"}
      </Text>
    </View>
  );


  const profileListItems: ProfileListItem[] = [
    { key: "profile-cover", content: profileCover },
    {
      key: "profile-tabs",
      content: (
        <View style={styles.tabsBackdrop}>
          <Animated.View
            pointerEvents={compactActive ? "none" : "box-none"}
            style={[styles.tabsBar, { opacity: tabsInverseFade }]}
          >
            {tabsContent}
          </Animated.View>
        </View>
      ),
    },
  ];

  if (games.length > 0) {
    profileListItems.push({
      key: "game-selector",
      content: (
        <View style={styles.scrollBody}>
          <GameSelector
            games={games}
            selectedGameId={activeGameId}
            onSelect={setSelectedGameId}
          />
        </View>
      ),
    });

    if (tab === "技能") {
      if (gameDetailQuery.isLoading) {
        profileListItems.push({
          key: "skills-loading",
          content: (
            <View style={styles.scrollBody}>
              <ProfileGameSkeleton />
            </View>
          ),
        });
      } else if (gameDetailQuery.isError || !gameDetail) {
        profileListItems.push({
          key: "skills-error",
          content: (
            <View style={styles.scrollBody}>
              <InlineState
                text="游戏技能加载失败"
                actionLabel="重试"
                onAction={() => void gameDetailQuery.refetch()}
              />
            </View>
          ),
        });
      } else {
        profileListItems.push(
          {
            key: "skills-summary",
            content: (
              <View style={styles.scrollBody}>
                <SkillsSummary detail={gameDetail} voicePlayer={voicePlayer} />
              </View>
            ),
          },
          {
            key: "services-title",
            content: (
              <View style={styles.scrollBody}>
                <Text style={[styles.sectionTitle, styles.serviceTitle]}>
                  陪玩服务
                </Text>
              </View>
            ),
          },
        );

        // TODO: 临时测试数据——接口数据 ×3 并改名,用于滚动效果联调,联调完成后删除
        const testSkillCards = gameDetail.skillCards.flatMap((card, index) =>
          [0, 1, 2].map((copy) => ({
            ...card,
            companionServiceId: -(index * 3 + copy + 1),
            modeName: `【测试数据${index * 3 + copy + 1}】${card.modeName}`,
          })),
        );

        if (testSkillCards.length > 0) {
          profileListItems.push(
            ...testSkillCards.map((card) => ({
              key: `service-${card.companionServiceId}-${card.gameLevelId}`,
              content: (
                <View style={styles.scrollBody}>
                  <ServiceCard
                    card={card}
                    onOrder={() => void openOrder(card)}
                  />
                </View>
              ),
            })),
          );
        } else {
          profileListItems.push({
            key: "services-empty",
            content: (
              <View style={styles.scrollBody}>
                <EmptyState message="暂无大神服务" />
              </View>
            ),
          });
        }
      }
    } else if (reviewQuery.isLoading) {
      profileListItems.push({
        key: "reviews-loading",
        content: (
          <View style={styles.scrollBody}>
            <ProfileGameSkeleton reviews />
          </View>
        ),
      });
    } else if (reviewQuery.isError) {
      profileListItems.push({
        key: "reviews-error",
        content: (
          <View style={styles.scrollBody}>
            <InlineState
              text="评价加载失败"
              actionLabel="重试"
              onAction={() => void reviewQuery.refetch()}
            />
          </View>
        ),
      });
    } else {
      const reviews = reviewQuery.data?.items ?? [];
      if (reviews.length === 0) {
        profileListItems.push({
          key: "reviews-empty",
          content: (
            <View style={styles.scrollBody}>
              <EmptyState message="暂无评价" hint="完成订单后会显示评价内容" />
            </View>
          ),
        });
      } else {
        profileListItems.push(
          ...reviews.map((review, index) => ({
            key: `review-${review.id}-${index}`,
            content: <ReviewCard review={review} />,
          })),
        );
      }
    }
  } else {
    profileListItems.push({
      key: "games-empty",
      content: (
        <View style={styles.scrollBody}>
          <EmptyState message="暂无支持的游戏" />
        </View>
      ),
    });
  }

  const editProfileButton = isMine ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="编辑个人资料"
      onPress={() => router.push("/edit-profile")}
      style={styles.editProfileButton}
    >
      <Edit24Regular color="#0A0A0A" height={20} width={20} />
      <Text style={styles.editProfileText}>编辑个人资料</Text>
    </Pressable>
  ) : null;

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <Animated.View
        style={[
          styles.navbar,
          styles.navbarOverlay,
          styles.navbarCompact,
          { paddingTop: insets.top },
        ]}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.navbarBg,
            { height: insets.top + 92, overflow: "hidden", opacity: headerFade },
          ]}
        >
          <Image
            source={coverImageUrl ? { uri: coverImageUrl } : background}
            contentFit="cover"
            style={styles.navbarBgImage}
          />
          <LinearGradient
            pointerEvents="none"
            style={styles.navbarBgOverlay}
            colors={["#3B79BA00", "#3B79BA", "#3B79BA"]}
            locations={[0, 0.6, 1]}
          />
          <LinearGradient
            pointerEvents="none"
            style={styles.navbarBgOverlay}
            colors={["rgba(0,0,0,0.2)", "rgba(0,0,0,0.8)"]}
          />
        </Animated.View>
        <View style={styles.navbarCompactRow}>
          <Pressable
            accessibilityLabel="返回"
            hitSlop={12}
            onPress={() => router.back()}
            style={[styles.navButton, { marginTop: 3 }]}
          >
            <Image source={backIcon} style={styles.backIcon} />
          </Pressable>
          <Animated.View
            pointerEvents="none"
            style={[styles.compactIdentity, { opacity: headerFade }]}
          >
            <Image
              source={profile.headImage ? { uri: profile.headImage } : fallbackAvatar}
              style={styles.compactAvatar}
            />
            <Text numberOfLines={1} style={styles.compactName}>
              {profile.nickname}
            </Text>
          </Animated.View>
        </View>
        <Animated.View
          pointerEvents={compactActive ? "box-none" : "none"}
          style={[styles.tabsBar, { opacity: headerFade, marginHorizontal: -12 }]}
        >
          {tabsContent}
        </Animated.View>
      </Animated.View>
      <FlatList
        style={styles.scrollView}
        data={profileListItems}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => item.content}
        ListFooterComponent={editProfileButton}
        ListFooterComponentStyle={isMine ? styles.profileListFooter : undefined}
        initialNumToRender={6}
        maxToRenderPerBatch={5}
        windowSize={5}
        onScroll={(event) => {
          // 头像块剩余 136→44px 区间内,紧凑头部淡入(透明度渐变)
          const fadeStart = coverHeight - 136;
          const progress = Math.max(
            0,
            Math.min(1, (event.nativeEvent.contentOffset.y - fadeStart) / 92),
          );
          headerFade.setValue(progress);
          const active = progress >= 1;
          if (active !== compactActive) setCompactActive(active);
        }}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: 1,
          paddingBottom: isMine ? 24 + insets.bottom : 88 + insets.bottom,
        }}
      />

      {!isMine ? (
        <View
          style={[
            styles.actionBar,
            { paddingBottom: Math.max(insets.bottom, 12) + 12 },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              followStateQuery.data?.followed ? "已关注" : "关注"
            }
            accessibilityState={{
              disabled: followStateQuery.isLoading || followMutation.isPending,
              busy: followMutation.isPending,
            }}
            disabled={followStateQuery.isLoading || followMutation.isPending}
            style={styles.followButton}
            onPress={() => void handleFollowPress()}
          >
            <Text style={styles.followText}>
              {followStateQuery.data?.followed ? "已关注" : "关注"}
            </Text>
          </Pressable>
          <Pressable
            style={styles.chatButton}
            onPress={() => void handleChatPress()}
          >
            <Text style={styles.chatText}>聊一聊</Text>
          </Pressable>
        </View>
      ) : null}
      {!isMine ? (
        <ProfileActionsSheet
          visible={profileActionsVisible}
          bottomInset={insets.bottom}
          isBlacklisted={
            !isMine &&
            blacklistStatus.userId === String(profile.userId) &&
            blacklistStatus.isBlacklisted
          }
          onClose={() => setProfileActionsVisible(false)}
          onReportRequest={() =>
            router.push({
              pathname: "/report",
              params: {
                userId: String(profile.userId),
                nickname: profile.nickname,
              },
            })
          }
          onBlockRequest={() => setBlacklistPromptVisible(true)}
        />
      ) : null}
      <AppPrompt
        visible={blacklistPromptVisible}
        title="拉黑提示"
        message="拉黑后，您将无法收到对方的私信，且相互无法进行下单操作"
        cancelText="取消"
        confirmText="确认"
        onCancel={() => setBlacklistPromptVisible(false)}
        onConfirm={() => {
          setBlacklistPromptVisible(false);
          void addToBlacklist(
            {
              userId: String(profile.userId),
              nickname: profile.nickname,
              headImage: profile.headImage,
              clubName: profile.clubName,
              clubId: String(profile.clubId),
            },
            useAuthStore.getState().accessToken ?? "",
          ).then(() => {
            Toast.show("加入黑名单成功", {
              duration: Toast.durations.SHORT,
            });
          });
        }}
      />
      {orderCard && gameDetail ? (
        <CompanionOrderSheet
          card={orderCard}
          profile={profile}
          gameName={gameDetail.gameName}
          context={{
            serviceUserId: profile.userId,
            clubId: profile.clubId,
            gameId: gameDetail.gameId,
            gameLevelId: orderCard.gameLevelId,
            gameModeName: orderCard.modeName,
            gameLevelName: orderCard.levelName,
            buyerUserId: Number(user?.id) || 0,
          }}
          token={useAuthStore.getState().accessToken}
          onClose={() => setOrderCard(null)}
          onRealNameVerificationRequired={() =>
            router.push("/account-settings")
          }
          onOrderCreated={(order) => {
            setOrderCard(null);
            setPaymentError(null);
            setPaymentOrder(order);
            setPaymentSheetVisible(true);
          }}
        />
      ) : null}
      {paymentOrder ? (
        <StarPaymentSheet
          order={paymentOrder}
          visible={paymentSheetVisible}
          token={useAuthStore.getState().accessToken}
          onClose={() => {
            void cancelPendingPaymentOrder();
          }}
          onPaid={() => {
            const paidOrderId = paymentOrder.orderId;
            setPaymentSheetVisible(false);
            setPaymentOrder(null);
            setPaymentError(null);
            void invalidateOrderQueries(paidOrderId);
            router.push({
              pathname: "/order/[id]",
              params: { id: String(paidOrderId) },
            });
          }}
          onPaymentFailed={(message) => setPaymentError(message)}
        />
      ) : null}
      <AppPrompt
        visible={Boolean(paymentError)}
        title="支付失败"
        message={paymentError ?? ""}
        onConfirm={() => setPaymentError(null)}
      />
      <AppPrompt
        visible={Boolean(paymentCancelError)}
        title="订单取消失败"
        message={paymentCancelError ?? ""}
        onConfirm={() => setPaymentCancelError(null)}
      />
    </View>
  );

  async function cancelPendingPaymentOrder() {
    const pendingOrder = paymentOrder;
    const token = useAuthStore.getState().accessToken;
    if (paymentCancelingRef.current) return;
    setPaymentSheetVisible(false);
    setPaymentOrder(null);
    if (!pendingOrder || !token) return;
    paymentCancelingRef.current = true;
    try {
      await cancelOrder(String(pendingOrder.orderId), token);
      void invalidateOrderQueries(pendingOrder.orderId);
    } catch (error) {
      setPaymentOrder(null);
      // The payment sheet is already dismissed; surface a cancellation error
      // without allowing the user to retry payment for the same order.
      setPaymentCancelError(
        error instanceof Error ? error.message : "订单取消失败",
      );
    } finally {
      paymentCancelingRef.current = false;
    }
  }

  async function openOrder(card: ProfileSkillCard) {
    if (!requireLogin()) return;
    try {
      if (await isUserBlacklisted(profile.userId)) {
        Toast.show("该用户已在黑名单中，无法下单", {
          duration: Toast.durations.SHORT,
        });
        return;
      }
      setOrderCard(card);
    } catch {
      Toast.show("黑名单状态读取失败，请稍后重试", {
        duration: Toast.durations.SHORT,
      });
    }
  }
}


function ProfileIdentity({
  profile,
  isBlacklisted,
}: {
  profile: ProfileDetail;
  isBlacklisted: boolean;
}) {
  const status = getStatus(profile.onlineStatus, profile.gameStatus);
  const age = profile.birth ? calculateAge(profile.birth) : "";
  const avatarPreviewParams = createProfileAvatarPreviewParams(
    profile.headImage,
  );
  const avatarImage = (
    <CachedImage
      source={profile.headImage ? { uri: profile.headImage } : fallbackAvatar}
      style={styles.avatar}
      contentFit="cover"
    />
  );

  return (
    <View style={styles.identity}>
      {avatarPreviewParams ? (
        <Pressable
          accessibilityLabel="预览头像"
          accessibilityRole="button"
          onPress={() =>
            router.push({
              pathname: "/image-preview",
              params: avatarPreviewParams,
            })
          }
          style={styles.avatarButton}
        >
          {avatarImage}
        </Pressable>
      ) : (
        avatarImage
      )}
      <View style={styles.identityCopy}>
        <View style={styles.nameRow}>
          <Text numberOfLines={1} style={styles.name}>
            {profile.nickname}
          </Text>

          {isBlacklisted ? (
            <View accessibilityLabel="已加入黑名单" style={styles.blacklistTag}>
              <Text style={styles.blacklistTagText}>已加入黑名单</Text>
            </View>
          ) : null}

          {profile.sex === 1 || profile.sex === 2 ? (
            <View style={styles.headerPill}>
              <Image
                source={profile.sex === 1 ? maleIcon : femaleIcon}
                style={styles.gender}
              />
              {age ? (
                <Text
                  style={profile.sex === 2 ? styles.femaleAge : styles.male}
                >
                  {age}
                </Text>
              ) : null}
            </View>
          ) : null}
          {status ? (
            <View style={styles.headerPill}>
              <Image
                source={
                  status.label === "游戏中" ? playingStatusIcon : idleStatusIcon
                }
                style={[styles.onlineIcon, { tintColor: status.color }]}
              />
              <Text style={[styles.onlineText, { color: status.color }]}>
                {status.label}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={styles.clubLine}>
          <Image source={clubIcon} style={styles.clubIcon} />
          <Text numberOfLines={1} style={styles.club}>
            {profile.clubName}
          </Text>
        </View>
      </View>
    </View>
  );
}

function GameSelector({
  games,
  selectedGameId,
  onSelect,
}: {
  games: ProfileGame[];
  selectedGameId: string;
  onSelect: (gameId: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.gameTags}
    >
      {games.map((game) => {
        const active = String(game.gameId) === selectedGameId;
        return (
          <Pressable
            key={game.gameId}
            onPress={() => onSelect(String(game.gameId))}
            style={[styles.gameTag, active && styles.gameTagActive]}
          >
            {game.iconUrl ? (
              <CachedImage
                source={{ uri: game.iconUrl }}
                style={styles.gameLogo}
              />
            ) : null}
            <Text style={[styles.gameText, active && styles.gameTextActive]}>
              {game.gameName}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function SkillsSummary({
  detail,
  voicePlayer,
}: {
  detail: ProfileGameDetail;
  voicePlayer: ReturnType<typeof useVoicePlayer>;
}) {
  return (
    <>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>能力介绍</Text>
        {detail.voiceUrl ? (
          <VoicePlayButton
            duration={detail.voiceDurationSeconds}
            inline
            onToggleVoice={voicePlayer.toggle}
            playingUrl={voicePlayer.playingUrl}
            url={detail.voiceUrl}
          />
        ) : null}
      </View>
      <Text style={styles.description}>
        {detail.skillIntro || "暂无能力介绍"}
      </Text>
      <ImageGallery images={detail.images.map((image) => image.imageUrl)} />
    </>
  );
}

function ImageGallery({ images }: { images: string[] }) {
  if (images.length === 0) return <EmptyState message="暂无技能图片" />;
  const visibleImages = images.slice(0, 5);

  return (
    <View style={styles.gallery}>
      {visibleImages.map((image, index) => (
        <Pressable
          key={`${image}-${index}`}
          accessibilityLabel={`预览技能图片 ${index + 1}`}
          onPress={() =>
            router.push({
              pathname: "/image-preview",
              params: createImagePreviewParams(images, index),
            })
          }
          style={styles.galleryItem}
        >
          <CachedImage
            source={{ uri: image }}
            contentFit="cover"
            style={StyleSheet.absoluteFill}
          />
          {index === 4 && images.length > 5 ? (
            <View style={styles.moreOverlay}>
              <Text style={styles.moreText}>+{images.length - 5}</Text>
            </View>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

function ServiceCard({
  card,
  onOrder,
}: {
  card: ProfileSkillCard;
  onOrder: () => void;
}) {
  return (
    <View style={styles.serviceCard}>
      <View style={styles.serviceCopy}>
        <Text numberOfLines={1} style={styles.serviceName}>
          {card.modeName}-{card.levelName}
        </Text>
        <View style={styles.serviceMeta}>
          <Text style={styles.price}>{card.price}</Text>
          {/* <Text style={styles.diamond}>◇</Text> */}
          <Image source={diamondIcon} style={styles.gameLogo} />
          <Text style={styles.metaText}>销量 {card.orderCount}</Text>
          {card.goodRate !== null && card.goodRate !== undefined ? (
            <Text style={styles.metaText}>{card.goodRate}%好评</Text>
          ) : null}
        </View>
      </View>
      <Pressable style={styles.orderButton} onPress={onOrder}>
        <Text style={styles.orderText}>下单</Text>
      </Pressable>
    </View>
  );
}


function ReviewCard({ review }: { review: ProfileReview }) {
  return (
    <View style={styles.reviewCard}>
      <Image
        source={
          review.buyerAvatar ? { uri: review.buyerAvatar } : fallbackAvatar
        }
        style={styles.reviewAvatar}
      />
      <View style={styles.reviewBody}>
        <View style={styles.reviewTopLine}>
          <Text numberOfLines={1} style={styles.reviewer}>
            {review.buyerNickname}
          </Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) =>
              star <= review.rating ? (
                <Star16Filled
                  key={star}
                  color="#FF943D"
                  width={12}
                  height={12}
                />
              ) : (
                <Star16Regular
                  key={star}
                  color="#EBEBEB"
                  width={12}
                  height={12}
                />
              ),
            )}
          </View>
        </View>
        <Text numberOfLines={2} style={styles.reviewText}>
          {review.content || "未填写评价内容"}
        </Text>
        {review.imageUrls.length > 0 ? (
          <View style={styles.reviewImages}>
            {review.imageUrls.map((image, index) => (
              <Pressable
                key={`${image}-${index}`}
                accessibilityLabel={`预览评价图片 ${index + 1}`}
                onPress={() =>
                  router.push({
                    pathname: "/image-preview",
                    params: createImagePreviewParams(review.imageUrls, index),
                  })
                }
                style={styles.reviewImage}
              >
                <CachedImage
                  source={{ uri: image }}
                  contentFit="cover"
                  style={StyleSheet.absoluteFill}
                />
              </Pressable>
            ))}
          </View>
        ) : null}
        <Text style={styles.reviewDate}>
          {formatReviewDate(review.evaluatedTime)}
        </Text>
      </View>
    </View>
  );
}

function ProfileState({
  text,
  actionLabel,
  onAction,
}: {
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.state}>
      <Text style={styles.stateText}>{text}</Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction}>
          <Text style={styles.retryText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function InlineState({
  text,
  actionLabel,
  onAction,
}: {
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.inlineState}>
      <Text style={styles.stateText}>{text}</Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction}>
          <Text style={styles.retryText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function toLocalProfile(
  user: ReturnType<typeof useAuthStore.getState>["user"],
): ProfileDetail {
  return {
    userId: Number(user?.id) || 0,
    nickname: user?.nickname || "登录 / 注册",
    signature: user?.signature || "",
    headImage: user?.headImage,
    sex: user?.gender,
    followCount: 0,
    fansCount: 0,
    clubId: user?.clubInfo?.id ?? 0,
    clubName: user?.clubInfo?.clubName || "暂无俱乐部",
    orderCount: 0,
    onlineStatus: 0,
    gameStatus: 0,
    games: [],
  };
}

function getStatus(onlineStatus: number, gameStatus: number) {
  if (gameStatus === 1) return { label: "游戏中", color: "#F5821D" };
  if (onlineStatus === 1) return { label: "空闲中", color: "#14A357" };
  return null;
}


function formatReviewDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.replace("T", " ").slice(0, 16);
  const pad = (number: number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff" },
  state: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#fff",
  },
  stateText: {
    color: "#999",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    textAlign: "center",
    padding: 24,
  },
  retryText: { color: "#FF3158", fontFamily: DOUYIN_SANS, fontSize: 14 },
  cover: {
    overflow: "hidden",
    backgroundColor: "#617181",
    justifyContent: "flex-end",
    // 头像顶部距屏幕顶部 92(含状态栏),与头像下方留白(92)一致
    paddingTop: 92,
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  headerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    height: 18,
    paddingHorizontal: 6,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.15)",
  },
  headerStats: {
    flexDirection: "row",
    gap: 16,
    marginTop: 12,
  },
  headerStat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  headerStatValue: {
    color: "#FFF",
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
  },
  headerStatLabel: {
    color: "#FFF",
    fontSize: 12,
    lineHeight: 22,
  },
  headerIntro: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 11,
    lineHeight: 16,
    textAlign: "left",
    marginTop: 12,
  },
  navbarOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  navbarCompact: {
    flex: 1,
    flexDirection: "column",
    overflow: "hidden",
  },
  starsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  navbarCompactRow: {
    flexDirection: "row",
    alignItems: "center",
    height: 44,
    paddingHorizontal: 12,
    gap: 8,
  },
  navbarBg: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    overflow: "hidden",
  },
  navbarBgImage: {
    width: "100%",
    aspectRatio: 1,
  },
  navbarBgOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    // 与默认封面同高(375),让遮罩在顶部条上的渐变进度与默认头部完全一致
    height: 375,
  },
  compactIdentity: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  compactAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  compactName: {
    flexShrink: 1,
    color: "#FFF",
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "600",
  },
  scrollView: { flex: 1, backgroundColor: "#fff" },
  coverShade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(24,35,47,0.52)",
  },
  navbar: {
    paddingHorizontal: 12,
    flexDirection: "column",
    alignItems: "stretch",
  },
  navButton: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  backIcon: { width: 24, height: 24, tintColor: "#fff" },
  identity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    borderColor: "#fff",
  },
  avatarButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: "hidden",
  },
  identityCopy: { flex: 1, minWidth: 0, gap: 6 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  name: {
    flexShrink: 1,
    color: "#fff",
    fontSize: 18,
    lineHeight: 26,
    fontWeight: "600",
  },
  blacklistTag: {
    flexShrink: 0,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.4)",
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  blacklistTagText: {
    color: "#FFFFFF",
    fontFamily: DOUYIN_SANS,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "500",
  },
  gender: { width: 15, height: 15 },
  male: {
    flexShrink: 0,
    fontSize: 12,
    color: "#0095EE",
    fontWeight: 500,
  },
  femaleAge: {
    flexShrink: 0,
    color: "#FF4770",
    fontSize: 12,
    fontWeight: 500,
  },
  online: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    minHeight: 18,
    maxHeight: 18,
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  onlineIcon: { width: 12, height: 12 },
  onlineText: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "500",
  },
  clubLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  clubIcon: { width: 14, height: 14, tintColor: "#D7DCE2" },
  club: {
    flexShrink: 1,
    color: "#C9CED4",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
  },
  scrollIntro: {
    marginTop: -1,
    paddingHorizontal: 16,
    backgroundColor: "#fff",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingTop: 16,
  },
  tabsBar: {
    flexDirection: "row",
    alignItems: "center",
    height: 48,
    paddingHorizontal: 16,
    gap: 24,
    backgroundColor: "#FFF",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  tabsBackdrop: {
    backgroundColor: "#141C28",
  },
  tabsBarInCover: {
    marginTop: 12,
  },
  stickyTabs: {
    paddingHorizontal: 16,
    backgroundColor: "#fff",
  },
  scrollBody: {
    paddingHorizontal: 16,
    backgroundColor: "#fff",
  },
  editProfileButton: {
    height: 48,
    marginHorizontal: 12,
    // marginTop: "auto",
    marginBottom: 8,
    borderRadius: 8,
    backgroundColor: "#FFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderColor: "#EBEBEB",
    borderWidth: 1,
    gap: 8,
    marginTop: 30,
  },
  profileListFooter: { flexGrow: 1 },
  editProfileText: {
    color: "#0A0A0A",
    fontFamily: DOUYIN_SANS,
    fontSize: 15,
  },
  stats: { flexDirection: "row", gap: 16 },
  stat: { flexDirection: "row", alignItems: "baseline", gap: 5 },
  statValue: {
    color: "#111",
    fontFamily: DOUYIN_SANS,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "700",
  },
  statLabel: { color: "#999", fontFamily: DOUYIN_SANS, fontSize: 14 },
  signature: {
    marginTop: 12,
    color: "#161616",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    lineHeight: 21,
  },
  tabs: { flexDirection: "row", gap: 28, height: 48, alignItems: "flex-end" },
  tabButton: {
    height: 42,
    minWidth: 36,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  tabText: { color: "#656566", fontFamily: DOUYIN_SANS, fontSize: 14, lineHeight: 22 },
  tabTextActive: { color: "#0D0D0F", fontWeight: "600", fontSize: 16, lineHeight: 22 },
  tabIndicator: {
    position: "absolute",
    bottom: 0,
    width: 12,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#FE1F4C",
  },
  gameTags: { flexDirection: "row", gap: 10, marginTop: 12, paddingRight: 16 },
  gameTag: {
    height: 32,
    paddingHorizontal: 6,
    borderRadius: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F5F6F7",
  },
  gameTagActive: {
    borderWidth: 0.5,
    borderColor: "#FE4267",
    backgroundColor: "#FFF5F7",
  },
  gameLogo: { width: 20, height: 20, borderRadius: 4 },
  gameText: { color: "#656566", fontFamily: DOUYIN_SANS, fontSize: 12, lineHeight: 18 },
  gameTextActive: { color: "#0A0A0A", fontWeight: "600" },
  sectionHeader: {
    marginTop: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    color: "#0A0A0A",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "500",
  },
  description: {
    marginTop: 14,
    color: "#656566",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    lineHeight: 18,
  },
  gallery: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 14 },
  galleryItem: {
    width: 62,
    height: 62,
    overflow: "hidden",
    borderRadius: 6,
    backgroundColor: "#ddd",
  },
  moreOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  moreText: { color: "#fff", fontSize: 18, fontWeight: "600" },
  successBackdrop: {
    flex: 1,
    paddingHorizontal: 36,
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.48)",
  },
  successDialog: {
    borderRadius: 20,
    backgroundColor: "#fff",
    alignItems: "center",
    padding: 28,
  },
  successMark: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E8FFF3",
  },
  successMarkText: { color: "#19B879", fontSize: 30, fontWeight: "700" },
  successTitle: {
    marginTop: 16,
    color: "#111",
    fontFamily: DOUYIN_SANS,
    fontSize: 20,
    fontWeight: "600",
  },
  successHint: {
    marginTop: 8,
    color: "#888",
    fontFamily: DOUYIN_SANS,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
  successButton: {
    alignSelf: "stretch",
    height: 46,
    marginTop: 24,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FF3158",
  },
  successButtonText: {
    color: "#fff",
    fontFamily: DOUYIN_SANS,
    fontSize: 16,
    fontWeight: "600",
  },
  serviceTitle: { marginTop: 28 },
  serviceCard: {
    minHeight: 67,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
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
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    fontWeight: "400",
  },
  serviceMeta: { flexDirection: "row", alignItems: "center", gap: 7 },
  price: {
    color: "#FF1F4C",
    fontFamily: DOUYIN_SANS,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "600",
  },
  diamond: { color: "#FF3158", fontSize: 14 },
  metaText: { color: "#979799", fontFamily: DOUYIN_SANS, fontSize: 11, lineHeight: 16 },
  orderButton: {
    flexShrink: 0,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#FF1F4C",
    alignItems: "center",
    justifyContent: "center",
  },
  orderText: { color: "#fff", fontFamily: DOUYIN_SANS, fontSize: 12, lineHeight: 18 },
  inlineState: { alignItems: "center", paddingVertical: 48 },
  empty: { alignItems: "center", paddingVertical: 48 },
  emptyText: { color: "#777", fontFamily: DOUYIN_SANS, fontSize: 14 },
  emptyHint: {
    marginTop: 8,
    color: "#aaa",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
  },
  reviewCard: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
  },
  reviewAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: "#EBEBEB",
  },
  reviewBody: { flex: 1, minWidth: 0, gap: 4 },
  reviewTopLine: { flexDirection: "row", alignItems: "center", gap: 4 },
  reviewer: {
    flex: 1,
    color: "#999",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    lineHeight: 18,
  },
  reviewText: {
    color: "#333",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    lineHeight: 22,
  },
  reviewImages: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  reviewImage: { width: 57, height: 57, borderRadius: 6, overflow: "hidden" },
  reviewDate: {
    color: "#999",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    lineHeight: 18,
  },
  actionBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    paddingTop: 8,
    backgroundColor: "#fff",
    flexDirection: "row",
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#eee",
  },
  followButton: {
    flex: 1,
    height: 42,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "#E5E5E5",
    alignItems: "center",
    justifyContent: "center",
  },
  followText: {
    color: "#111",
    fontFamily: DOUYIN_SANS,
    fontSize: 16,
    fontWeight: "600",
  },
  chatButton: {
    flex: 1,
    height: 42,
    borderRadius: 7,
    backgroundColor: "#FF3158",
    alignItems: "center",
    justifyContent: "center",
  },
  chatText: {
    color: "#fff",
    fontFamily: DOUYIN_SANS,
    fontSize: 16,
    fontWeight: "600",
  },
});
