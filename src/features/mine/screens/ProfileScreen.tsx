import { CachedImage } from "@/shared/ui/CachedImage";
import { useAuthStore } from "@esports/auth";
import {
  ChevronLeft24Regular,
  MoreHorizontal24Regular,
  Star16Filled,
  Star16Regular,
} from "@fluentui/react-native-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useIsFocused, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ReactElement,
} from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
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
  removeFromBlacklist,
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
import {
  createImagePreviewParams,
} from "@/features/mine/image-preview.params";
import { createProfileAvatarPreviewParams } from "@/features/mine/profile-avatar-preview";
import { createProfileChatParams } from "@/features/mine/profile-chat";
import { calculateAge } from "@/features/mine/profile-utils";
import { afterOrderPaidOpenChat } from "@/features/order/notify-order-paid";
import { invalidateOrderQueries } from "@/features/order/order-query";
import { useVoicePlayer } from "@/shared/audio/use-voice-player";
import { VoicePlayButton } from "@/shared/audio/VoicePlayButton";
import { requireLogin } from "@/shared/navigation/require-login";
import { showToast } from "@/shared/ui/app-toast";
import { AppPrompt } from "@/shared/ui/AppPrompt";
import { EmptyState } from "@/shared/ui/AsyncStates";

const fallbackAvatar = require("../../../../assets/mine/mine-avatar.png");
const maleIcon = require("../../../../assets/svgs/gender-male.svg");
const femaleIcon = require("../../../../assets/svgs/gender-female.svg");
const backIcon = require("../../../../assets/svgs/icon-back.svg");
const clubIcon = require("../../../../assets/svgs/profile-club-flag.svg");
const arrowDownIcon = require("../../../../assets/svgs/intro-toggle.svg");
const diamondIcon = require("../../../../assets/message/order-assistant-coin-3f6fcf.webp");
const idleStatusIcon = require("../../../../assets/svgs/club-status-idle.svg");
const playingStatusIcon = require("../../../../assets/svgs/club-status-playing.svg");
const NAV_BAR_CONTENT_HEIGHT = 44;
const PROFILE_IDENTITY_TOP_GAP = 12;
type ProfileTab = "技能" | "评价";
type ProfileListItem = { key: string; content: ReactElement };

const profileKeyExtractor = (item: ProfileListItem) => item.key;
const profileRenderItem = ({ item }: { item: ProfileListItem }) => item.content;

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const user = useAuthStore((state) => state.user);
  const route = useLocalSearchParams<{
    clubId?: string | string[];
    userId?: string | string[];
    fromSearch?: string | string[];
    reorderGame?: string;
    reorderMode?: string;
    reorderLevel?: string;
    reorderService?: string;
    reorderQuantity?: string;
  }>();
  const routeClubId = route.clubId;
  const routeUserId = route.userId;
  const routeParams = useMemo(
    () => getProfileRouteParams({ clubId: routeClubId, userId: routeUserId }),
    [routeClubId, routeUserId],
  );
  const isMine = !routeParams || String(user?.id ?? "") === routeParams.userId;
  const [tab, setTab] = useState<ProfileTab>("技能");
  const [coverHeight, setCoverHeight] = useState(0);
  const [compactActive, setCompactActive] = useState(false);
  const scrollY = useMemo(() => new Animated.Value(0), []);
  // 紧凑头部切换阈值：列表内标签行（两侧圆角的技能/评价栏）与固定标签行对齐时立刻切换。
  // 用 1px 行程做原生驱动的阶跃淡入淡出，达到阈值即默认头部马上隐藏、紧凑头部马上出现，
  // 不做渐变过渡（渐变会在两头部间产生同屏叠显）。封面未布局完成前恒为 0，防止闪现。
  const fadeStart = coverHeight - insets.top - NAV_BAR_CONTENT_HEIGHT;
  const headerFade = useMemo(
    () =>
      coverHeight === 0
        ? new Animated.Value(0)
        : scrollY.interpolate({
            inputRange: [fadeStart - 1, fadeStart],
            outputRange: [0, 1],
            extrapolate: "clamp",
          }),
    [scrollY, coverHeight, fadeStart],
  );
  // 滚动走原生驱动；JS 侧仅在跨越紧凑头部阈值时 setState 一次（同值自动豁免）。
  const handleScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
        useNativeDriver: true,
        listener: (event: {
          nativeEvent: { contentOffset: { y: number } };
        }) => {
          const active = event.nativeEvent.contentOffset.y >= fadeStart;
          setCompactActive((prev) => (prev === active ? prev : active));
        },
      }),
    [scrollY, fadeStart],
  );
  const [selectedGameId, setSelectedGameId] = useState("");
  const [orderCard, setOrderCard] = useState<ProfileSkillCard | null>(null);
  const [reorderActive, setReorderActive] = useState(false);
  const reorderHandled = useRef(false);
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
  const chatCheckPendingRef = useRef(false);
  const detailQuery = useProfileDetail(routeParams, focused);
  const detail = detailQuery.data;
  const followStateQuery = useUserFollowState(
    !isMine && detail ? String(detail.userId) : undefined,
    focused,
  );
  const followMutation = useToggleUserFollow();
  const firstGameId = getFirstProfileGameId(detail?.games ?? []);
  const activeGameId = detail?.games.some(
    (game) => String(game.gameId) === selectedGameId,
  )
    ? selectedGameId
    : String(detail?.games.find((game) => game.gameName === route.reorderGame)?.gameId ?? firstGameId);

  const gameDetailQuery = useProfileGameDetail(
    routeParams && (detail?.clubId || routeParams.clubId) && activeGameId
      ? {
          clubId: String(detail?.clubId || routeParams.clubId),
          userId: routeParams.userId,
          gameId: activeGameId,
        }
      : null,
    focused,
  );
  // 评价按陪玩师整体拉取（全部游戏），不做游戏分类过滤
  const reviewQuery = useProfileReviews(
    tab === "评价" && routeParams
      ? { companionUserId: routeParams.userId }
      : null,
    focused,
  );
  const gameDetailLoading = gameDetailQuery.isLoading;
  const gameDetailError = gameDetailQuery.isError;
  const refetchGameDetail = gameDetailQuery.refetch;
  const reviewLoading = reviewQuery.isLoading;
  const reviewError = reviewQuery.isError;
  const reviewItems = reviewQuery.data?.items;
  const refetchReviews = reviewQuery.refetch;
  const localProfile = useMemo(() => toLocalProfile(user), [user]);
  const profile = detail ?? localProfile;
  const measureCover = useCallback((height: number) => {
    setCoverHeight((prev) => (Math.abs(height - prev) > 1 ? height : prev));
  }, []);

  useEffect(() => {
    if (!focused || isMine || profile.userId <= 0) {
      return;
    }

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
  }, [focused, isMine, profile.userId]);

  const gameDetail = gameDetailQuery.data;
  const games = useMemo(() => detail?.games ?? [], [detail]);
  // 头部封面直接使用本人头像；source 引用稳定，避免列表项重建
  const coverImageSource = useMemo(
    () => (profile.headImage ? { uri: profile.headImage } : fallbackAvatar),
    [profile.headImage],
  );
  const voicePlayer = useVoicePlayer();
  const stopVoice = voicePlayer.stop;
  const toggleVoice = voicePlayer.toggle;
  const playingVoiceUrl = voicePlayer.playingUrl;

  useEffect(() => {
    if (tab !== "技能" || !focused) {
      stopVoice();
    }
  }, [focused, tab, stopVoice]);
  const openProfileRelation = useCallback(
    (type: "following" | "fans") => {
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
    },
    [profile, routeParams],
  );
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
      showToast(state.followed ? "关注成功" : "已取消关注");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "操作失败");
    }
  };

  const handleChatPress = async () => {
    if (!requireLogin() || chatCheckPendingRef.current) return;
    chatCheckPendingRef.current = true;

    try {
      if (await isUserBlacklisted(profile.userId)) {
        showToast("该用户已在黑名单中，无法发起聊天");
        return;
      }

      // push 进聊天；params 带 fromProfile 标记，聊天页返回主页时用 dismissTo 弹回，避免循环套娃
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
      showToast("黑名单状态读取失败，请稍后重试");
    } finally {
      chatCheckPendingRef.current = false;
    }
  };

  const openOrder = useCallback(
    async (card: ProfileSkillCard) => {
      if (!requireLogin()) return;
      try {
        if (await isUserBlacklisted(profile.userId)) {
          showToast("该用户已在黑名单中，无法下单");
          return;
        }
        setOrderCard(card);
      } catch {
        showToast("黑名单状态读取失败，请稍后重试");
      }
    },
    [profile.userId],
  );
  useEffect(() => {
    if (!route.reorderGame || reorderHandled.current || !detail) {
      return;
    }
    const matchingGames = detail.games.filter((game) => game.gameName === route.reorderGame);
    if (matchingGames.length !== 1) {
      reorderHandled.current = true;
      showToast("原订单游戏已变更，请重新选择服务");
      return;
    }
    const gameId = String(matchingGames[0].gameId);
    if (activeGameId !== gameId) {
      return;
    }
    if (gameDetailQuery.isError) {
      reorderHandled.current = true;
      showToast("服务加载失败，请重新选择服务");
      return;
    }
    if (!gameDetail || String(gameDetail.gameId) !== gameId) {
      return;
    }
    const cards = gameDetail.skillCards.filter((card) =>
      card.modeName === route.reorderMode && card.levelName === route.reorderLevel,
    );
    const levelIds = new Set(cards.map((card) => card.gameLevelId));
    if (levelIds.size !== 1 || !route.reorderService) {
      reorderHandled.current = true;
      showToast("原订单服务已变更，请重新选择服务");
      return;
    }
    reorderHandled.current = true;
    Promise.resolve().then(() => {
      setReorderActive(true);
      openOrder(cards[0]);
    });
  }, [activeGameId, detail, gameDetail, gameDetailQuery.isError, openOrder, route.reorderGame, route.reorderLevel, route.reorderMode, route.reorderService]);
  // 默认头部中的标签栏:紧凑头部淡入时反向淡出
  const tabsInverseFade = useMemo(
    () =>
      headerFade.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 0],
      }),
    [headerFade],
  );

  const profileListItems = useMemo<ProfileListItem[]>(() => {
    const profileListItems: ProfileListItem[] = [
      {
        key: "profile-cover",
        content: (
          <ProfileCover
            topInset={insets.top}
            profile={profile}
            coverImageSource={coverImageSource}
            isMine={isMine}
            isBlacklisted={
              !isMine &&
              blacklistStatus.userId === String(profile.userId) &&
              blacklistStatus.isBlacklisted
            }
            onSelectRelation={openProfileRelation}
            onMeasure={measureCover}
          />
        ),
      },
      {
        key: "profile-tabs",
        content: (
          <View style={styles.tabsBackdrop}>
            <Animated.View
              pointerEvents={compactActive ? "none" : "box-none"}
              style={[styles.tabsBar, { opacity: tabsInverseFade }]}
            >
              <ProfileTabs tab={tab} onSelect={setTab} />
            </Animated.View>
          </View>
        ),
      },
    ];

    // 游戏筛选栏仅服务技能 tab；评价 tab 拉取陪玩师全部评价，不按游戏分类
    if (tab === "技能") {
      if (games.length === 0) {
        profileListItems.push({
          key: "games-empty",
          content: (
            <View style={styles.scrollBody}>
              <EmptyState message="暂无支持的游戏" />
            </View>
          ),
        });
      } else {
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

        if (gameDetailLoading) {
          profileListItems.push({
            key: "skills-loading",
            content: (
              <View style={styles.scrollBody}>
                <ProfileGameSkeleton />
              </View>
            ),
          });
        } else if (gameDetailError || !gameDetail) {
          profileListItems.push({
            key: "skills-error",
            content: (
              <View style={styles.scrollBody}>
                <InlineState
                  text="游戏技能加载失败"
                  actionLabel="重试"
                  onAction={() => void refetchGameDetail()}
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
                  <SkillsSummary
                    detail={gameDetail}
                    onToggleVoice={toggleVoice}
                    playingUrl={playingVoiceUrl}
                  />
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
              ...gameDetail.skillCards.map((card, index) => ({
                key: `service-${card.companionServiceId}-${card.gameLevelId}`,
                content: (
                  <View style={styles.scrollBody}>
                    <ServiceCard
                      card={card}
                      first={index === 0}
                      onOrder={openOrder}
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
      }
    } else if (reviewLoading) {
      profileListItems.push({
        key: "reviews-loading",
        content: (
          <View style={styles.scrollBody}>
            <ProfileGameSkeleton reviews />
          </View>
        ),
      });
    } else if (reviewError) {
      profileListItems.push({
        key: "reviews-error",
        content: (
          <View style={styles.scrollBody}>
            <InlineState
              text="评价加载失败"
              actionLabel="重试"
              onAction={() => void refetchReviews()}
            />
          </View>
        ),
      });
    } else {
      const reviews = reviewItems ?? [];
      if (reviews.length === 0) {
        profileListItems.push({
          key: "reviews-empty",
          content: (
            <View style={styles.scrollBody}>
              <EmptyState
                message="暂无评价"
                hint="完成订单后会显示评价内容"
              />
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

    return profileListItems;
  }, [
    insets.top,
    profile,
    coverImageSource,
    isMine,
    blacklistStatus,
    openProfileRelation,
    measureCover,
    compactActive,
    tabsInverseFade,
    tab,
    games,
    activeGameId,
    gameDetailLoading,
    gameDetailError,
    refetchGameDetail,
    gameDetail,
    reviewLoading,
    reviewError,
    reviewItems,
    refetchReviews,
    toggleVoice,
    playingVoiceUrl,
    openOrder,
  ]);

  if (routeParams && (detailQuery.isLoading || (!focused && !detail))) {
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
      <ProfileErrorState
        topInset={insets.top}
        message={
          detailQuery.error instanceof Error && detailQuery.error.message
            ? detailQuery.error.message
            : "个人主页加载失败"
        }
        onRetry={detailQuery.refetch}
      />
    );
  }

  const editProfileButton = isMine ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="编辑个人资料"
      onPress={() => router.push("/edit-profile")}
      style={styles.editProfileButton}
    >
      <Text style={styles.editProfileText}>编辑个人资料</Text>
    </Pressable>
  ) : null;

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <Animated.View
        style={[
          styles.navbarOverlay,
          styles.navbarCompact,
          { paddingTop: insets.top },
        ]}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.navbarBg,
            {
              height: insets.top + NAV_BAR_CONTENT_HEIGHT + 48,
              overflow: "hidden",
              opacity: headerFade,
            },
          ]}
        >
          <Image
            source={coverImageSource}
            contentFit="cover"
            contentPosition="top"
            style={StyleSheet.absoluteFill}
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
            style={styles.navButton}
          >
            <ChevronLeft24Regular color="#fff" width={24} height={24} />
          </Pressable>
          <Animated.View
            pointerEvents="none"
            style={[styles.compactIdentity, { opacity: headerFade }]}
          >
            <Image
              source={
                profile.headImage ? { uri: profile.headImage } : fallbackAvatar
              }
              style={styles.compactAvatar}
            />
            <Text numberOfLines={1} style={styles.compactName}>
              {profile.nickname}
            </Text>
          </Animated.View>
          <View style={styles.navActions}>
            {!isMine ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="更多操作"
                hitSlop={12}
                onPress={() => setProfileActionsVisible(true)}
                style={styles.navActionButton}
              >
                <MoreHorizontal24Regular color="#fff" width={24} height={24} />
              </Pressable>
            ) : null}
          </View>
        </View>
        <Animated.View
          pointerEvents={compactActive ? "box-none" : "none"}
          style={[styles.tabsBar, { opacity: headerFade }]}
        >
          <ProfileTabs tab={tab} onSelect={setTab} />
        </Animated.View>
      </Animated.View>
      <Animated.FlatList
        style={styles.scrollView}
        data={profileListItems}
        keyExtractor={profileKeyExtractor}
        renderItem={profileRenderItem}
        initialNumToRender={6}
        maxToRenderPerBatch={5}
        windowSize={5}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: 1,
          paddingBottom: 88 + insets.bottom,
        }}
      />

      <View
        style={[
          styles.actionBar,
          { paddingBottom: Math.max(insets.bottom, 12) + 12 },
        ]}
      >
        {isMine ? (
          editProfileButton
        ) : (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                followStateQuery.data?.followed ? "已关注" : "关注"
              }
              accessibilityState={{
                disabled:
                  followStateQuery.isLoading || followMutation.isPending,
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
          </>
        )}
      </View>
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
          onBlockRequest={() => {
            const currentlyBlacklisted =
              blacklistStatus.userId === String(profile.userId) &&
              blacklistStatus.isBlacklisted;
            if (currentlyBlacklisted) {
              removeFromBlacklist(
                String(profile.userId),
                useAuthStore.getState().accessToken ?? "",
              )
                .then(() => {
                  showToast("已取消拉黑");
                })
                .catch((error: unknown) => {
                  showToast(error instanceof Error ? error.message : "操作失败");
                });
            } else {
              setBlacklistPromptVisible(true);
            }
          }}
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
          addToBlacklist(
            {
              userId: String(profile.userId),
              nickname: profile.nickname,
              headImage: profile.headImage,
              clubName: profile.clubName,
              clubId: String(profile.clubId),
            },
            useAuthStore.getState().accessToken ?? "",
          )
            .then(() => {
              showToast("加入黑名单成功");
            })
            .catch((error: unknown) => {
              showToast(error instanceof Error ? error.message : "操作失败");
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
          initialServiceName={reorderActive ? route.reorderService : undefined}
          initialQuantity={reorderActive ? Number(route.reorderQuantity) : undefined}
          onClose={() => {
            setOrderCard(null);
            setReorderActive(false);
          }}
          onRealNameVerificationRequired={() =>
            router.push("/account-settings")
          }
          onOrderCreated={(order) => {
            setOrderCard(null);
            setReorderActive(false);
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
            const orderId = paymentOrder.orderId;
            setPaymentSheetVisible(false);
            setPaymentOrder(null);
            invalidateOrderQueries(orderId);
          }}
          onPaid={() => {
            const paidOrderId = paymentOrder.orderId;
            const companionUserId = String(profile.userId);
            const chatParams = createProfileChatParams({
              userId: profile.userId,
              nickname: profile.nickname,
              headImage: profile.headImage,
              clubId: profile.clubId,
            });
            const accessToken = useAuthStore.getState().accessToken;
            setPaymentSheetVisible(false);
            setPaymentOrder(null);
            setPaymentError(null);
            void invalidateOrderQueries(paidOrderId);
            void afterOrderPaidOpenChat({
              companionUserIds: [companionUserId],
              token: accessToken,
              chat: {
                id: chatParams.id,
                title: chatParams.title,
                avatar: chatParams.avatar || undefined,
                clubId: chatParams.clubId,
                fromProfile: chatParams.fromProfile,
              },
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
    </View>
  );

}

// 头部标签栏独立组件：滚动阈值切换等无关重渲染时保持元素引用稳定
const ProfileTabs = memo(function ProfileTabs({
  tab,
  onSelect,
}: {
  tab: ProfileTab;
  onSelect: (tab: ProfileTab) => void;
}) {
  return (
    <View style={styles.tabs}>
      {(["技能", "评价"] as ProfileTab[]).map((item) => (
        <Pressable
          key={item}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === item }}
          onPress={() => onSelect(item)}
          style={styles.tabButton}
        >
          <Text style={[styles.tabText, tab === item && styles.tabTextActive]}>
            {item}
          </Text>
          {tab === item ? <View style={styles.tabIndicator} /> : null}
        </Pressable>
      ))}
    </View>
  );
});

// 头部封面独立组件：列表项内容引用稳定，滚动期不被父组件重渲染波及
const ProfileCover = memo(function ProfileCover({
  topInset,
  profile,
  coverImageSource,
  isMine,
  isBlacklisted,
  onSelectRelation,
  onMeasure,
}: {
  topInset: number;
  profile: ProfileDetail;
  coverImageSource: ComponentProps<typeof Image>["source"];
  isMine: boolean;
  isBlacklisted: boolean;
  onSelectRelation: (type: "following" | "fans") => void;
  onMeasure: (height: number) => void;
}) {
  const [introExpanded, setIntroExpanded] = useState(false);
  const [introOverflows, setIntroOverflows] = useState(false);
  return (
    <View
      style={[
        styles.cover,
        {
          paddingTop:
            topInset + NAV_BAR_CONTENT_HEIGHT + PROFILE_IDENTITY_TOP_GAP,
        },
      ]}
      onLayout={(event) => onMeasure(event.nativeEvent.layout.height)}
    >
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Image
          source={coverImageSource}
          contentFit="cover"
          style={StyleSheet.absoluteFill}
        />
      </View>
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
      <ProfileIdentity profile={profile} isBlacklisted={isBlacklisted} />
      <View style={styles.headerStats}>
        <Pressable
          accessibilityRole={isMine ? "button" : "text"}
          accessibilityLabel={`关注列表，${profile.followCount}人`}
          disabled={!isMine}
          onPress={() => onSelectRelation("following")}
          style={styles.headerStat}
        >
          <Text style={styles.headerStatValue}>{profile.followCount}</Text>
          <Text style={styles.headerStatLabel}>关注</Text>
        </Pressable>
        <Pressable
          accessibilityRole={isMine ? "button" : "text"}
          accessibilityLabel={`粉丝列表，${profile.fansCount}人`}
          disabled={!isMine}
          onPress={() => onSelectRelation("fans")}
          style={styles.headerStat}
        >
          <Text style={styles.headerStatValue}>{profile.fansCount}</Text>
          <Text style={styles.headerStatLabel}>粉丝</Text>
        </Pressable>
      </View>
      <View style={styles.introBlock}>
        <Text
          numberOfLines={introExpanded ? undefined : 2}
          ellipsizeMode="tail"
          style={styles.headerIntro}
          onTextLayout={(event) => {
            // 收起态下可见行数达到 2 行说明被截断，此时才展示展开/收起按钮
            if (introExpanded) return;
            const overflows = event.nativeEvent.lines.length >= 2;
            setIntroOverflows((prev) => (prev === overflows ? prev : overflows));
          }}
        >
          {profile.signature || "暂无个人简介"}
        </Text>
        {profile.signature && (introExpanded || introOverflows) ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={introExpanded ? "收起简介" : "展开简介"}
            hitSlop={6}
            onPress={() => setIntroExpanded((prev) => !prev)}
            style={styles.introToggle}
          >
            <Image
              source={arrowDownIcon}
              style={[
                styles.introToggleIcon,
                introExpanded && styles.introToggleIconUp,
              ]}
            />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
});

function ProfileIdentity({
  profile,
  isBlacklisted,
}: {
  profile: ProfileDetail;
  isBlacklisted: boolean;
}) {
  const route = useLocalSearchParams<{
    fromClubId?: string | string[];
    fromSearch?: string | string[];
  }>();
  const fromClubId =
    typeof route.fromClubId === "string" ? route.fromClubId : undefined;
  const fromSearch = route.fromSearch === "1";
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

          {profile.sex === 1 || profile.sex === 2 ? (
            <View style={styles.headerPill}>
              <Image
                source={profile.sex === 1 ? maleIcon : femaleIcon}
                style={[
                  styles.gender,
                  { tintColor: profile.sex === 1 ? "#3DA5FF" : "#FF42A1" },
                ]}
              />
              {age ? (
                <Text
                  allowFontScaling={false}
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
        <View style={styles.idClubRow}>
          {profile.tagName ? (
            <View
              accessibilityLabel={`大神标签：${profile.tagName}`}
              style={[
                styles.companionTag,
                { backgroundColor: profile.tagColor || "#C0C4CC" },
              ]}
            >
              <Text style={styles.companionTagText}>{profile.tagName}</Text>
            </View>
          ) : null}
          {profile.clubId > 0 ? (
            <Pressable
              style={styles.clubLine}
              onPress={() => {
                // 来源就是这家俱乐部主页时直接出栈回退，俱乐部/个人主页来回点不再无限堆栈
                if (fromClubId && fromClubId === String(profile.clubId)) {
                  router.back();
                  return;
                }
                router.push({
                  pathname: "/club/[id]",
                  // fromUserId 标记来源个人主页，俱乐部页点回该成员时直接出栈，避免套娃
                  params: {
                    id: String(profile.clubId),
                    fromUserId: String(profile.userId),
                    ...(fromSearch ? { fromSearch: "1" } : {}),
                  },
                });
              }}
            >
              <Image source={clubIcon} style={styles.clubIcon} />
              <Text numberOfLines={1} style={styles.clubName}>
                {profile.clubName || "俱乐部"}
              </Text>
            </Pressable>
          ) : null}
          {profile.userId ? (
            <Text style={styles.idRow}>ID：{profile.userId}</Text>
          ) : null}
          {isBlacklisted ? (
            <View accessibilityLabel="已加入黑名单" style={styles.blacklistTag}>
              <Text style={styles.blacklistTagText}>已加入黑名单</Text>
            </View>
          ) : null}
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
                style={styles.gameTagIcon}
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
  onToggleVoice,
  playingUrl,
}: {
  detail: ProfileGameDetail;
  onToggleVoice: (voiceUrl: string) => void;
  playingUrl: string | null;
}) {
  return (
    <>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>能力介绍</Text>
        {detail.voiceUrl ? (
          <VoicePlayButton
            duration={detail.voiceDurationSeconds}
            inline
            onToggleVoice={onToggleVoice}
            playingUrl={playingUrl}
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
  // 无图时保留插画空态，但压缩上方留白，避免大块空白把服务模式挤远
  if (images.length === 0) {
    return <EmptyState message="暂无技能图片" style={styles.galleryEmpty} />;
  }
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
            cachePolicy="disk"
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

const ServiceCard = memo(function ServiceCard({
  card,
  first,
  onOrder,
}: {
  card: ProfileSkillCard;
  first: boolean;
  onOrder: (card: ProfileSkillCard) => void;
}) {
  return (
    <View style={[styles.serviceCard, first ? styles.serviceCardFirst : null]}>
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
      <Pressable style={styles.orderButton} onPress={() => onOrder(card)}>
        <Text style={styles.orderText}>下单</Text>
      </Pressable>
    </View>
  );
});

const ReviewCard = memo(function ReviewCard({
  review,
}: {
  review: ProfileReview;
}) {
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
                  cachePolicy="disk"
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
});

function ProfileErrorState({
  topInset,
  message,
  onRetry,
}: {
  topInset: number;
  message: string;
  onRetry: () => void;
}) {
  return (
    <View style={styles.state}>
      <View style={[styles.errorNavbar, { paddingTop: topInset + 12 }]}>
        <Pressable
          accessibilityLabel="返回"
          accessibilityRole="button"
          hitSlop={12}
          onPress={() => router.back()}
          style={styles.navButton}
        >
          <Image source={backIcon} style={styles.errorBackIcon} />
        </Pressable>
      </View>
      <View style={styles.errorBody}>
        <Text style={styles.stateText}>{message}</Text>
        <Pressable accessibilityRole="button" onPress={onRetry}>
          <Text style={styles.retryText}>重试</Text>
        </Pressable>
      </View>
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
    birth: user?.birth,
    followCount: 0,
    fansCount: 0,
    clubId: user?.clubInfo?.id ?? 0,
    clubName: user?.clubInfo?.clubName || "暂无俱乐部",
    orderCount: 0,
    onlineStatus: 0,
    gameStatus: 0,
    tagName: "",
    tagColor: "",
    games: [],
  };
}

// 状态口径与 Web getCompanionStatus 对齐：必须先确认在线，
// 离线时残留的 gameStatus=1 不能覆盖成「游戏中」。
function getStatus(onlineStatus: number, gameStatus: number) {
  if (onlineStatus !== 1) {
    return null;
  }
  if (gameStatus === 1) {
    return { label: "游戏中", color: "#F5821D" };
  }
  return { label: "空闲中", color: "#14A357" };
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
  errorNavbar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    alignItems: "flex-start",
  },
  errorBody: {
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  errorBackIcon: { width: 24, height: 24, tintColor: "#0D0D0F" },
  stateText: {
    color: "#999",
    fontSize: 14,
    textAlign: "center",
    padding: 24,
  },
  retryText: { color: "#FE1F4C", fontSize: 14 },
  cover: {
    overflow: "hidden",
    backgroundColor: "#617181",
    justifyContent: "flex-end",
    // 头像位于安全区和导航栏下方，与俱乐部主页保持 12 的间距。
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
  },
  introBlock: {
    position: "relative",
    paddingRight: 30,
    marginTop: 12,
  },
  introToggle: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 20,
    height: 16,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  introToggleIcon: {
    width: 20,
    height: 16,
  },
  introToggleIconUp: {
    transform: [{ rotate: "180deg" }],
  },
  navbarOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  navbarCompact: {
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
    height: NAV_BAR_CONTENT_HEIGHT,
    paddingHorizontal: 12,
    gap: 8,
  },
  navbarBg: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    overflow: "hidden",
    // 与默认封面底色一致：背景图未就绪或带透明通道时也不透出下方滚动内容
    backgroundColor: "#617181",
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
  navButton: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  navActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  navActionButton: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
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
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.6)",
  },
  avatarButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: "hidden",
  },
  identityCopy: { flex: 1, minWidth: 0, gap: 6 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
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
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "500",
  },
  gender: { width: 12, height: 12 },
  male: {
    flexShrink: 0,
    fontSize: 12,
    lineHeight: 18,
    color: "#3DA5FF",
    fontWeight: 500,
    includeFontPadding: false,
  },
  femaleAge: {
    flexShrink: 0,
    color: "#FF42A1",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: 500,
    includeFontPadding: false,
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
    includeFontPadding: false,
  },
  idClubRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  // 大神标签：与陪玩卡片标签保持一致的尺寸与排版
  companionTag: {
    borderRadius: 2,
    paddingHorizontal: 2,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  companionTagText: {
    color: "#FFF",
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "500",
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  idRow: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    lineHeight: 18,
  },
  clubLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 1,
  },
  clubIcon: { width: 14, height: 14 },
  clubName: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    lineHeight: 18,
    flexShrink: 1,
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
    flex: 1,
    height: 42,
    borderRadius: 8,
    backgroundColor: "#FFF",
    alignItems: "center",
    justifyContent: "center",
    borderColor: "#E9E9EB",
    borderWidth: 1,
  },
  editProfileText: {
    color: "#0D0D0F",
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 22,
  },
  stats: { flexDirection: "row", gap: 16 },
  stat: { flexDirection: "row", alignItems: "baseline", gap: 5 },
  statValue: {
    color: "#111",
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "700",
  },
  statLabel: { color: "#999", fontSize: 14 },
  signature: {
    marginTop: 12,
    color: "#161616",
    fontSize: 14,
    lineHeight: 21,
  },
  tabs: { flexDirection: "row", gap: 28, height: 48, alignItems: "center" },
  tabButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minWidth: 36,
    position: "relative",
  },
  tabText: {
    color: "#999",
    fontSize: 14,
    lineHeight: 22,
  },
  tabTextActive: {
    color: "#1a1a1a",
    fontWeight: "700",
    fontSize: 16,
    lineHeight: 22,
  },
  tabIndicator: {
    position: "absolute",
    bottom: -6,
    left: "50%",
    marginLeft: -6,
    width: 12,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "#FE1F4C",
  },
  // paddingBottom 1：部分 Android 屏幕密度下 32dp 取整后最后 1px 物理行落在
  // 横向 ScrollView 裁剪区外，选中态的圆角边框底部会被裁掉，留 1px 余量兼容
  gameTags: { flexDirection: "row", gap: 10, marginTop: 12, paddingRight: 16, paddingBottom: 1 },
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
  gameLogo: { width: 15, height: 12.8, borderRadius: 4 },
  gameTagIcon: { width: 20, height: 20, borderRadius: 4 },
  gameText: {
    color: "#656566",
    fontSize: 12,
    lineHeight: 18,
  },
  gameTextActive: { color: "#0A0A0A", fontWeight: "600" },
  sectionHeader: {
    marginTop: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    color: "#0A0A0A",
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "500",
  },
  description: {
    marginTop: 14,
    color: "#656566",
    fontSize: 12,
    lineHeight: 18,
  },
  gallery: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 14 },
  // 默认空态 minHeight 240，这里收紧到插画+文案的紧凑高度
  galleryEmpty: { minHeight: 150 },
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
    fontSize: 20,
    fontWeight: "600",
  },
  successHint: {
    marginTop: 8,
    color: "#888",
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
    backgroundColor: "#FE1F4C",
  },
  successButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  serviceTitle: { marginTop: 28 },
  serviceCard: {
    minHeight: 67,
    // 卡片之间间距 8；首张与上方「陪玩服务」标题间距 12
    marginTop: 8,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#F7F7F7",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  serviceCardFirst: { marginTop: 12 },
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
  diamond: { color: "#FE1F4C", fontSize: 14 },
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
    color: "#fff",
    fontSize: 12,
    lineHeight: 18,
  },
  inlineState: { alignItems: "center", paddingVertical: 48 },
  empty: { alignItems: "center", paddingVertical: 48 },
  emptyText: { color: "#777", fontSize: 14 },
  emptyHint: {
    marginTop: 8,
    color: "#aaa",
    fontSize: 12,
  },
  reviewList: { marginHorizontal: 8, marginTop: 8 },
  reviewListItem: { marginHorizontal: 8 },
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
    fontSize: 12,
    lineHeight: 18,
  },
  reviewText: {
    color: "#333",
    fontSize: 14,
    lineHeight: 22,
  },
  reviewImages: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  reviewImage: { width: 57, height: 57, borderRadius: 6, overflow: "hidden" },
  reviewDate: {
    color: "#999",
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
    fontSize: 16,
    fontWeight: "600",
  },
  chatButton: {
    flex: 1,
    height: 42,
    borderRadius: 7,
    backgroundColor: "#FE1F4C",
    alignItems: "center",
    justifyContent: "center",
  },
  chatText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
