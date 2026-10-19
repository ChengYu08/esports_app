import { CachedImage } from "@/shared/ui/CachedImage";
import { useAuthStore } from "@esports/auth";
import {
  Edit24Regular,
  Flag24Regular,
  MoreHorizontal24Regular,
  PersonProhibited24Regular,
} from "@fluentui/react-native-icons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import {
  Animated,
  Easing,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  buildCreateOrderAction,
  createCompanionOrder,
  fetchCompanionServices,
  fetchStarBalance,
  payCompanionOrder,
  type CompanionOrderContext,
  type CompanionServiceOption,
} from "@/features/mine/api/companion-order.api";
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
import {
  ProfileGameSkeleton,
  ProfileSkeleton,
} from "@/features/mine/components/ProfileSkeleton";
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
import {
  handleOrderFailurePromptConfirm,
  requiresRealNameVerification,
} from "@/features/mine/order-real-name";
import { createProfileAvatarPreviewParams } from "@/features/mine/profile-avatar-preview";
import { createProfileChatParams } from "@/features/mine/profile-chat";
import { invalidateOrderQueries } from "@/features/order/order-query";
import { cancelOrder } from "@/features/order/order.api";
import { useVoicePlayer } from "@/shared/audio/use-voice-player";
import { VoicePlayButton } from "@/shared/audio/VoicePlayButton";
import { requireLogin } from "@/shared/navigation/require-login";
import { DOUYIN_SANS } from "@/shared/theme/typography";
import { AppPrompt } from "@/shared/ui/AppPrompt";
import { EmptyState } from "@/shared/ui/AsyncStates";
import { BottomSheet } from "@/shared/ui/BottomSheet";
import Toast from "react-native-root-toast";
// mine-avatar
const fallbackAvatar = require("../../../../assets/mine/figma/mine-avatar.png");
const background = require("../../../../assets/mine/figma/profile-bg.png");
const maleIcon = require("../../../../assets/home/club-detail/male.svg");
const femaleIcon = require("../../../../assets/mine/figma/mine-female.svg");
const clubIcon = require("../../../../assets/mine/figma/mine-club-flag.svg");
const backIcon = require("../../../../assets/home/club-detail/icon-back.svg");
const diamondIcon = require("../../../../assets/home/club-detail/icon-diamond.svg");
const idleStatusIcon = require("../../../../assets/home/club-detail/status-idle.svg");
const playingStatusIcon = require("../../../../assets/home/club-detail/status-playing.svg");
const paymentCloseIcon = require("../../../../assets/mine/payment-close.svg");
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
  const [selectedGameId, setSelectedGameId] = useState("");
  const [orderCard, setOrderCard] = useState<ProfileSkillCard | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
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

  const profileIntro = (
    <View style={styles.scrollIntro}>
      <View style={styles.stats}>
        <Stat
          value={profile.followCount}
          label="关注"
          onPress={() => openProfileRelation("following")}
        />
        <Stat
          value={profile.fansCount}
          label="粉丝"
          onPress={() => openProfileRelation("fans")}
        />
      </View>
      <Text style={styles.signature}>
        {profile.signature || "暂无个人简介"}
      </Text>
    </View>
  );

  const profileTabs = (
    <View style={styles.stickyTabs}>
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
    </View>
  );

  const profileListItems: ProfileListItem[] = [
    { key: "profile-tabs", content: profileTabs },
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

        if (gameDetail.skillCards.length > 0) {
          profileListItems.push(
            ...gameDetail.skillCards.map((card) => ({
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
            content: (
              <View
                style={index === 0 ? styles.reviewList : styles.reviewListItem}
              >
                <ReviewCard review={review} />
              </View>
            ),
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
      <View style={styles.cover}>
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
            <View pointerEvents="none" style={styles.coverShade} />
          </Pressable>
        ) : (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Image
              source={background}
              contentFit="cover"
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.coverShade} />
          </View>
        )}
        <View style={[styles.navbar, { paddingTop: insets.top }]}>
          <Pressable
            accessibilityLabel="返回"
            hitSlop={12}
            onPress={() => router.back()}
            style={styles.navButton}
          >
            <Image source={backIcon} style={styles.backIcon} />
          </Pressable>
          {!isMine ? (
            <Pressable
              accessibilityLabel="更多操作"
              accessibilityRole="button"
              hitSlop={12}
              onPress={() => setProfileActionsVisible(true)}
              style={styles.navButton}
            >
              <MoreHorizontal24Regular color="#fff" height={24} width={24} />
            </Pressable>
          ) : (
            <View style={styles.navButton} />
          )}
        </View>
        <ProfileIdentity
          profile={profile}
          isBlacklisted={
            !isMine &&
            blacklistStatus.userId === String(profile.userId) &&
            blacklistStatus.isBlacklisted
          }
        />
      </View>

      <FlatList
        style={styles.scrollView}
        data={profileListItems}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => item.content}
        ListHeaderComponent={profileIntro}
        ListFooterComponent={editProfileButton}
        ListFooterComponentStyle={isMine ? styles.profileListFooter : undefined}
        stickyHeaderIndices={[1]}
        initialNumToRender={6}
        maxToRenderPerBatch={5}
        windowSize={5}
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
            { paddingBottom: Math.max(insets.bottom, 12) },
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
          void addToBlacklist({
            userId: String(profile.userId),
            nickname: profile.nickname,
            headImage: profile.headImage,
            clubName: profile.clubName,
            clubId: String(profile.clubId),
          }).then(() => {
            Toast.show("加入黑名单成功", {
              duration: Toast.durations.SHORT,
            });
          });
        }}
      />
      {orderCard && gameDetail ? (
        <CompanionOrderSheet
          card={orderCard}
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
            setPaymentSuccess(false);
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
            setPaymentSheetVisible(false);
            setPaymentOrder(null);
            setPaymentError(null);
            void invalidateOrderQueries(paymentOrder.orderId);
            setPaymentSuccess(true);
          }}
          onPaymentFailed={(message) => setPaymentError(message)}
        />
      ) : null}
      <AppPrompt
        visible={paymentSuccess}
        title="支付成功"
        message="订单已支付，前往聊天与对方沟通服务安排。订单进度可在订单页面查看。"
        confirmText="去聊天"
        cancelText="稍后联系"
        onCancel={() => setPaymentSuccess(false)}
        onConfirm={() => {
          setPaymentSuccess(false);
          void handleChatPress();
        }}
      />
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
      setPaymentSuccess(false);
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

function ProfileActionsSheet({
  visible,
  bottomInset,
  onClose,
  onReportRequest,
  onBlockRequest,
}: {
  visible: boolean;
  bottomInset: number;
  onClose: () => void;
  onReportRequest: () => void;
  onBlockRequest: () => void;
}) {
  const { height: windowHeight } = useWindowDimensions();
  const [backdropOpacity] = useState(() => new Animated.Value(0));
  const [sheetTranslateY] = useState(() => new Animated.Value(windowHeight));
  const isClosing = useRef(false);

  useEffect(() => {
    if (!visible) return;

    isClosing.current = false;
    backdropOpacity.setValue(0);
    sheetTranslateY.setValue(windowHeight);
    const animation = Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(sheetTranslateY, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    animation.start();
    return () => animation.stop();
  }, [backdropOpacity, sheetTranslateY, visible, windowHeight]);

  function closeSheet(afterClose?: () => void) {
    if (!visible || isClosing.current) return;
    isClosing.current = true;
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 160,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(sheetTranslateY, {
        toValue: windowHeight,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (!finished) return;
      isClosing.current = false;
      onClose();
      afterClose?.();
    });
  }

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={() => closeSheet()}
    >
      <Animated.View
        style={[styles.profileActionsBackdrop, { opacity: backdropOpacity }]}
      >
        <Pressable
          accessibilityLabel="关闭更多操作"
          onPress={() => closeSheet()}
          style={StyleSheet.absoluteFill}
        />
        <Animated.View
          style={[
            styles.profileActionsSheet,
            {
              paddingBottom: Math.max(bottomInset, 16),
              transform: [{ translateY: sheetTranslateY }],
            },
          ]}
        >
          <View style={styles.profileActionsHandle} />
          <Pressable
            accessibilityLabel="举报"
            accessibilityRole="button"
            onPress={() => closeSheet(onReportRequest)}
            style={({ pressed }) => [
              styles.profileActionRow,
              pressed && styles.profileActionRowPressed,
            ]}
          >
            <Flag24Regular color="#333" height={24} width={24} />
            <Text style={styles.profileActionLabel}>举报</Text>
          </Pressable>
          <View style={styles.profileActionsDivider} />
          <Pressable
            accessibilityLabel="拉黑"
            accessibilityRole="button"
            onPress={() => closeSheet(onBlockRequest)}
            style={({ pressed }) => [
              styles.profileActionRow,
              pressed && styles.profileActionRowPressed,
            ]}
          >
            <PersonProhibited24Regular color="#333" height={24} width={24} />
            <Text style={styles.profileActionLabel}>拉黑</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
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
            <Image
              source={profile.sex === 1 ? maleIcon : femaleIcon}
              style={styles.gender}
            />
          ) : null}

          {age ? (
            <Text style={profile.sex === 2 ? styles.femaleAge : styles.male}>
              {age}
            </Text>
          ) : null}
          {status ? (
            <View
              style={[styles.online, { backgroundColor: `${status.color}24` }]}
            >
              <Image
                source={
                  status.label === "游戏中" ? playingStatusIcon : idleStatusIcon
                }
                style={styles.onlineIcon}
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

function Stat({
  value,
  label,
  onPress,
}: {
  value: number;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}列表，${value}人`}
      onPress={onPress}
      style={styles.stat}
    >
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Pressable>
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
          <Text style={styles.metaText}>订单{card.orderCount}</Text>
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

function CompanionOrderSheet({
  card,
  context,
  token,
  onClose,
  onRealNameVerificationRequired,
  onOrderCreated,
}: {
  card: ProfileSkillCard;
  context: CompanionOrderContext;
  token: string | null;
  onClose: () => void;
  onRealNameVerificationRequired: () => void;
  onOrderCreated: (order: { orderId: number; total: number }) => void;
}) {
  const [services, setServices] = useState<CompanionServiceOption[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState(
    card.companionServiceId,
  );
  const [quantity, setQuantity] = useState("1");
  const [remark, setRemark] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(Boolean(token));
  const [submitting, setSubmitting] = useState(false);
  const [prompt, setPrompt] = useState<{
    title?: string;
    message: string;
  } | null>(null);
  const [sheetY] = useState(() => new Animated.Value(420));
  const [backdropOpacity] = useState(() => new Animated.Value(0));
  const closing = useRef(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(sheetY, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
    return () => {
      sheetY.stopAnimation();
      backdropOpacity.stopAnimation();
    };
  }, [backdropOpacity, sheetY]);

  useEffect(() => {
    if (!token) return;
    void fetchCompanionServices(
      {
        clubId: context.clubId,
        serviceUserId: context.serviceUserId,
        gameLevelId: context.gameLevelId,
      },
      token,
    )
      .then((items) => {
        setServices(items);
        if (
          !items.some((item) => item.companionServiceId === selectedServiceId)
        ) {
          setSelectedServiceId(items[0]?.companionServiceId ?? 0);
        }
      })
      .catch((error: Error) => setPrompt({ message: error.message }))
      .finally(() => setLoading(false));
  }, [
    context.clubId,
    context.gameLevelId,
    context.serviceUserId,
    selectedServiceId,
    token,
  ]);

  const selectedService = services.find(
    (item) => item.companionServiceId === selectedServiceId,
  );
  const count = Math.max(1, Number.parseInt(quantity, 10) || 1);
  const total = (selectedService?.price ?? card.price) * count;

  async function submitOrder() {
    if (!token) {
      router.push("/login");
      return;
    }
    if (!selectedService || !agreed)
      return setPrompt({ message: "请选择服务并同意服务协议" });
    setSubmitting(true);
    try {
      const action = buildCreateOrderAction(
        context,
        selectedService,
        count,
        remark,
      );
      const order = await createCompanionOrder(action, token);
      onOrderCreated({
        orderId: order.orderId,
        total: Number(order.totalPrice) || action.total,
      });
    } catch (error) {
      setPrompt({
        title: "订单创建失败",
        message: error instanceof Error ? error.message : "创建订单失败",
      });
    } finally {
      setSubmitting(false);
    }
  }

  function closeSheet(afterClose?: () => void) {
    if (closing.current) return;
    closing.current = true;
    Animated.parallel([
      Animated.timing(sheetY, {
        toValue: 420,
        duration: 210,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 170,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        onClose();
        afterClose?.();
      }
    });
  }

  return (
    <Modal
      animationType="none"
      transparent
      visible
      onRequestClose={() => closeSheet()}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.orderKeyboardAvoiding}
      >
        <Animated.View
          style={[styles.orderModalBackdrop, { opacity: backdropOpacity }]}
        >
          <>
            <Pressable
              accessibilityLabel="关闭下单弹窗"
              onPress={() => closeSheet()}
              style={StyleSheet.absoluteFill}
            />
            <Animated.View
              style={[
                styles.orderModal,
                { transform: [{ translateY: sheetY }] },
              ]}
            >
              <View style={styles.orderModalHeader}>
                <Text style={styles.orderModalTitle}>陪玩下单</Text>
                <Pressable onPress={() => closeSheet()}>
                  <Text style={styles.orderClose}>×</Text>
                </Pressable>
              </View>
              <>
                <Text style={styles.orderLocked}>
                  {card.modeName}-{card.levelName}
                </Text>
                {loading ? (
                  <Text style={styles.orderHint}>服务加载中...</Text>
                ) : (
                  services.map((service) => (
                    <Pressable
                      key={service.companionServiceId}
                      onPress={() =>
                        setSelectedServiceId(service.companionServiceId)
                      }
                      style={[
                        styles.serviceOption,
                        selectedServiceId === service.companionServiceId &&
                          styles.serviceOptionActive,
                      ]}
                    >
                      <Text style={styles.serviceOptionName}>
                        {service.name}
                      </Text>
                      <Text style={styles.serviceOptionPrice}>
                        {service.price} 星钻
                      </Text>
                    </Pressable>
                  ))
                )}
                <View style={styles.quantityRow}>
                  <Text style={styles.orderLabel}>数量</Text>
                  <TextInput
                    keyboardType="number-pad"
                    value={quantity}
                    onChangeText={setQuantity}
                    style={styles.quantityInput}
                  />
                </View>
                <TextInput
                  placeholder="备注（选填）"
                  value={remark}
                  onChangeText={setRemark}
                  style={styles.remarkInput}
                />
                <Pressable
                  onPress={() => setAgreed((value) => !value)}
                  style={styles.agreementRow}
                >
                  <Text style={styles.checkbox}>{agreed ? "✓" : ""}</Text>
                  <Text style={styles.agreementText}>
                    我已阅读并同意服务协议
                  </Text>
                </Pressable>
                <Text style={styles.orderTotal}>合计：{total} 星钻</Text>
                <Pressable
                  style={[
                    styles.orderSubmit,
                    (!agreed ||
                      submitting ||
                      (Boolean(token) && !selectedService)) &&
                      styles.orderSubmitDisabled,
                  ]}
                  onPress={() => void submitOrder()}
                  disabled={
                    !agreed ||
                    submitting ||
                    (Boolean(token) && !selectedService)
                  }
                >
                  <Text style={styles.orderSubmitText}>
                    {submitting ? "提交中..." : "确认下单"}
                  </Text>
                </Pressable>
              </>
            </Animated.View>
          </>
        </Animated.View>
      </KeyboardAvoidingView>
      <AppPrompt
        visible={Boolean(prompt)}
        title={prompt?.title}
        message={prompt?.message ?? ""}
        cancelText={
          requiresRealNameVerification(prompt?.message ?? "")
            ? "我知道了"
            : undefined
        }
        confirmText={
          requiresRealNameVerification(prompt?.message ?? "")
            ? "去认证"
            : undefined
        }
        onCancel={() => setPrompt(null)}
        onConfirm={() => {
          handleOrderFailurePromptConfirm(prompt?.message ?? "", {
            dismissPrompt: () => setPrompt(null),
            dismissSheet: closeSheet,
            openVerification: onRealNameVerificationRequired,
          });
        }}
      />
    </Modal>
  );
}

function StarPaymentSheet({
  order,
  visible,
  token,
  onClose,
  onPaid,
  onPaymentFailed,
}: {
  order: { orderId: number; total: number };
  visible: boolean;
  token: string | null;
  onClose: () => void | Promise<void>;
  onPaid: () => void;
  onPaymentFailed: (message: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [balance, setBalance] = useState<number | null>(null);
  const [paying, setPaying] = useState(false);
  const settledRef = useRef(false);
  const [prompt, setPrompt] = useState<{
    title?: string;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!token) return;
    void fetchStarBalance(token)
      .then(setBalance)
      .catch((error: Error) => setPrompt({ message: error.message }));
  }, [token]);

  async function pay() {
    if (!token) return setPrompt({ message: "请先登录" });
    if ((balance ?? 0) < order.total)
      return setPrompt({
        title: "余额不足",
        message: "当前星钻余额不足，请充值后再支付",
      });
    setPaying(true);
    try {
      await payCompanionOrder(order.orderId, token);
      settledRef.current = true;
      onPaid();
    } catch (error) {
      onPaymentFailed(error instanceof Error ? error.message : "支付失败");
      if (!settledRef.current) {
        settledRef.current = true;
        await onClose();
      }
    } finally {
      setPaying(false);
    }
  }

  return (
    <>
      <BottomSheet
        visible={visible}
        onClose={() => void onClose()}
        scrollable
        contentStyle={[
          styles.paymentModal,
          { paddingBottom: Math.max(insets.bottom, 16) },
        ]}
      >
        <View style={styles.paymentModalHeader}>
          <View style={styles.paymentModalHeading}>
            <Text style={styles.paymentModalTitle}>星钻支付</Text>
            <Text style={styles.paymentModalHint}>
              请在5分钟内支付，否则订单自动取消
            </Text>
          </View>
          <Pressable
            accessibilityLabel="关闭星钻支付"
            hitSlop={8}
            onPress={() => void onClose()}
            style={styles.paymentClose}
          >
            <Image source={paymentCloseIcon} style={styles.paymentCloseIcon} />
          </Pressable>
        </View>
        <View style={styles.orderPaymentContent}>
          <Text style={styles.orderPayAmount}>支付 {order.total} 星钻</Text>
          <Text style={styles.orderBalance}>
            当前余额：{balance ?? "加载中..."} 星钻
          </Text>
          <Pressable
            style={styles.orderSubmit}
            onPress={() => void pay()}
            disabled={paying || balance === null}
          >
            <Text style={styles.orderSubmitText}>
              {paying ? "支付中..." : "确认支付"}
            </Text>
          </Pressable>
        </View>
      </BottomSheet>
      <AppPrompt
        visible={Boolean(prompt)}
        title={prompt?.title}
        message={prompt?.message ?? ""}
        onConfirm={() => setPrompt(null)}
      />
    </>
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
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Text
                key={star}
                style={[
                  styles.star,
                  star <= review.rating && styles.starActive,
                ]}
              >
                ★
              </Text>
            ))}
          </View>
        </View>
        <Text numberOfLines={2} style={styles.reviewText}>
          {review.content || "未填写评价内容"}
        </Text>
        {review.imageUrls.length > 0 ? (
          <View style={styles.reviewImages}>
            {review.imageUrls.slice(0, 3).map((image, index) => (
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
  if (gameStatus === 1) return { label: "游戏中", color: "#1E5EFF" };
  if (onlineStatus === 1) return { label: "空闲中", color: "#16C978" };
  return null;
}

function calculateAge(birth: string) {
  const date = new Date(birth);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  let age = now.getFullYear() - date.getFullYear();
  const birthdayPassed =
    now.getMonth() > date.getMonth() ||
    (now.getMonth() === date.getMonth() && now.getDate() >= date.getDate());
  if (!birthdayPassed) age -= 1;
  return age > 0 ? String(age) : "";
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
  cover: { height: 185, overflow: "hidden", backgroundColor: "#617181" },
  scrollView: { flex: 1, backgroundColor: "#fff" },
  coverShade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(24,35,47,0.52)",
  },
  navbar: {
    height: 68,
    paddingHorizontal: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  navButton: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  backIcon: { width: 24, height: 24, tintColor: "#fff" },
  profileActionsBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  profileActionsSheet: {
    paddingTop: 10,
    paddingHorizontal: 16,
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  profileActionsHandle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    marginBottom: 8,
    borderRadius: 2,
    backgroundColor: "#D9D9D9",
  },
  profileActionRow: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  profileActionRowPressed: { opacity: 0.6 },
  profileActionLabel: {
    marginLeft: 12,
    color: "#222",
    fontFamily: DOUYIN_SANS,
    fontSize: 16,
  },
  profileActionsDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 40,
    backgroundColor: "#EEEEEE",
  },
  identity: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
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
    fontSize: 16,
    lineHeight: 22,
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
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    lineHeight: 12,
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
  tabText: { color: "#777", fontFamily: DOUYIN_SANS, fontSize: 16 },
  tabTextActive: { color: "#111", fontWeight: "600" },
  tabIndicator: {
    position: "absolute",
    bottom: 0,
    width: 12,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#FF3158",
  },
  gameTags: { flexDirection: "row", gap: 10, marginTop: 12, paddingRight: 16 },
  gameTag: {
    height: 32,
    paddingHorizontal: 6,
    borderRadius: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F5F5F5",
  },
  gameTagActive: {
    borderWidth: 1,
    borderColor: "#FF3158",
    backgroundColor: "#fff",
  },
  gameLogo: { width: 15, height: 15 },
  gameText: { color: "#777", fontFamily: DOUYIN_SANS, fontSize: 14 },
  gameTextActive: { color: "#111" },
  sectionHeader: {
    marginTop: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    color: "#111",
    fontFamily: DOUYIN_SANS,
    fontSize: 16,
    fontWeight: "600",
  },
  description: {
    marginTop: 14,
    color: "#222",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    lineHeight: 20,
  },
  gallery: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 14 },
  galleryItem: {
    width: 65,
    height: 65,
    overflow: "hidden",
    borderRadius: 5,
    backgroundColor: "#ddd",
  },
  moreOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  moreText: { color: "#fff", fontSize: 18, fontWeight: "600" },
  orderModalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  orderKeyboardAvoiding: {
    flex: 1,
    justifyContent: "flex-end",
  },
  orderModal: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 20,
    paddingBottom: 30,
    gap: 14,
  },
  orderModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  orderModalTitle: {
    color: "#111",
    fontFamily: DOUYIN_SANS,
    fontSize: 18,
    fontWeight: "600",
  },
  orderClose: { color: "#777", fontSize: 28, lineHeight: 28 },
  paymentModal: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  paymentModalHeader: {
    minHeight: 74,
    paddingLeft: 16,
    paddingTop: 16,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  paymentModalHeading: { flex: 1, minWidth: 0, gap: 8 },
  paymentModalTitle: {
    color: "#0A0A0A",
    fontFamily: DOUYIN_SANS,
    fontSize: 16,
    fontWeight: "500",
    lineHeight: 24,
  },
  paymentModalHint: {
    color: "#808080",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    lineHeight: 18,
  },
  paymentClose: {
    width: 32,
    height: 32,
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  paymentCloseIcon: { width: 32, height: 32 },
  orderPaymentContent: { paddingHorizontal: 16, gap: 12 },
  orderLocked: { color: "#333", fontFamily: DOUYIN_SANS, fontSize: 15 },
  orderHint: { color: "#999", fontFamily: DOUYIN_SANS, fontSize: 14 },
  serviceOption: {
    minHeight: 48,
    paddingHorizontal: 12,
    borderRadius: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F6F6F6",
  },
  serviceOptionActive: {
    backgroundColor: "#FFF0F3",
    borderWidth: 1,
    borderColor: "#FF3158",
  },
  serviceOptionName: {
    flex: 1,
    color: "#222",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
  },
  serviceOptionPrice: {
    color: "#FF3158",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    fontWeight: "600",
  },
  quantityRow: {
    height: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  orderLabel: { color: "#222", fontFamily: DOUYIN_SANS, fontSize: 15 },
  quantityInput: {
    width: 92,
    height: 38,
    borderRadius: 6,
    backgroundColor: "#F6F6F6",
    color: "#222",
    fontFamily: DOUYIN_SANS,
    fontSize: 15,
    textAlign: "center",
  },
  remarkInput: {
    minHeight: 48,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#F6F6F6",
    color: "#222",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
  },
  agreementRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FF3158",
    color: "#FF3158",
    fontSize: 12,
    lineHeight: 14,
    textAlign: "center",
  },
  agreementText: { color: "#777", fontFamily: DOUYIN_SANS, fontSize: 12 },
  orderTotal: {
    color: "#111",
    fontFamily: DOUYIN_SANS,
    fontSize: 17,
    fontWeight: "600",
    textAlign: "right",
  },
  orderSubmit: {
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FF3158",
    alignItems: "center",
    justifyContent: "center",
  },
  orderSubmitDisabled: { backgroundColor: "#F4A8B7" },
  orderSubmitText: {
    color: "#fff",
    fontFamily: DOUYIN_SANS,
    fontSize: 16,
    fontWeight: "600",
  },
  orderPayAmount: {
    color: "#111",
    fontFamily: DOUYIN_SANS,
    fontSize: 20,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 12,
  },
  orderBalance: {
    color: "#777",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    textAlign: "center",
    marginBottom: 12,
  },
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
    color: "#111",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    fontWeight: "600",
  },
  serviceMeta: { flexDirection: "row", alignItems: "center", gap: 7 },
  price: {
    color: "#FF3158",
    fontFamily: DOUYIN_SANS,
    fontSize: 16,
    fontWeight: "600",
  },
  diamond: { color: "#FF3158", fontSize: 14 },
  metaText: { color: "#999", fontFamily: DOUYIN_SANS, fontSize: 12 },
  orderButton: {
    flexShrink: 0,
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FF3158",
    alignItems: "center",
    justifyContent: "center",
  },
  orderText: { color: "#fff", fontFamily: DOUYIN_SANS, fontSize: 14 },
  inlineState: { alignItems: "center", paddingVertical: 48 },
  empty: { alignItems: "center", paddingVertical: 48 },
  emptyText: { color: "#777", fontFamily: DOUYIN_SANS, fontSize: 14 },
  emptyHint: {
    marginTop: 8,
    color: "#aaa",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
  },
  reviewList: { marginHorizontal: 8, marginTop: 8 },
  reviewListItem: { marginHorizontal: -16 },
  reviewCard: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 0.5,
    borderBottomColor: "#EBEBEB",
  },
  reviewAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: "#EBEBEB",
  },
  reviewBody: { flex: 1, minWidth: 0, gap: 6 },
  reviewTopLine: { flexDirection: "row", alignItems: "center", gap: 4 },
  reviewer: {
    flex: 1,
    color: "#999",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    lineHeight: 18,
  },
  stars: { flexDirection: "row", gap: 2 },
  star: { color: "#EBEBEB", fontSize: 12, lineHeight: 14 },
  starActive: { color: "#FF943D" },
  reviewText: {
    color: "#333",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    lineHeight: 22,
  },
  reviewImages: { flexDirection: "row", gap: 4 },
  reviewImage: { width: 64, height: 64, borderRadius: 8, overflow: "hidden" },
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
