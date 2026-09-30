import { useAuthStore } from "@esports/auth";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
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
  useProfileDetail,
  useProfileGameDetail,
  useProfileReviews,
} from "@/features/mine/hooks/use-profile-data";
import { DOUYIN_SANS } from "@/shared/theme/typography";
import { createImagePreviewParams } from "@/features/mine/image-preview.params";

const fallbackAvatar = require("../../../../assets/mine/figma/profile-avatar.png");
const background = require("../../../../assets/mine/figma/profile-bg.png");
const femaleIcon = require("../../../../assets/mine/figma/mine-female.svg");
const clubIcon = require("../../../../assets/mine/figma/mine-club-flag.svg");
const settingsIcon = require("../../../../assets/mine/figma/mine-settings.svg");
const backIcon = require("../../../../assets/home/club-detail/icon-back.svg");

type ProfileTab = "技能" | "评价";

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
  const detailQuery = useProfileDetail(routeParams);
  const detail = detailQuery.data;
  const firstGameId = getFirstProfileGameId(detail?.games ?? []);
  const activeGameId = detail?.games.some(
    (game) => String(game.gameId) === selectedGameId,
  )
    ? selectedGameId
    : firstGameId;

  const gameDetailQuery = useProfileGameDetail(
    routeParams && activeGameId
      ? { ...routeParams, gameId: activeGameId }
      : null,
  );
  const reviewQuery = useProfileReviews(
    tab === "评价" && routeParams && activeGameId
      ? { gameId: activeGameId, companionUserId: routeParams.userId }
      : null,
  );
  const localProfile = useMemo(() => toLocalProfile(user), [user]);
  const profile = detail ?? localProfile;
  const gameDetail = gameDetailQuery.data;
  const games = detail?.games ?? [];

  if (routeParams && detailQuery.isLoading) {
    return <ProfileState text="加载中..." />;
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

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: isMine ? 24 + insets.bottom : 88 + insets.bottom,
        }}
      >
        <View style={styles.cover}>
          <Image
            source={
              gameDetail?.backgroundUrl
                ? { uri: gameDetail.backgroundUrl }
                : background
            }
            contentFit="cover"
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.coverShade} />
          <View style={[styles.navbar, { paddingTop: insets.top }]}>
            <Pressable
              accessibilityLabel="返回"
              hitSlop={12}
              onPress={() => router.back()}
              style={styles.navButton}
            >
              <Image source={backIcon} style={styles.backIcon} />
            </Pressable>
            {isMine ? (
              <Pressable
                accessibilityLabel="设置"
                hitSlop={12}
                onPress={() => undefined}
                style={styles.navButton}
              >
                <Image source={settingsIcon} style={styles.settingsIcon} />
              </Pressable>
            ) : (
              <View style={styles.navButton} />
            )}
          </View>
          <ProfileIdentity profile={profile} />
        </View>

        <View style={styles.content}>
          <View style={styles.stats}>
            <Stat value={profile.followCount} label="关注" />
            <Stat value={profile.fansCount} label="粉丝" />
          </View>
          <Text style={styles.signature}>
            {profile.signature || "暂无个人简介"}
          </Text>
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

          {games.length > 0 ? (
            <GameSelector
              games={games}
              selectedGameId={activeGameId}
              onSelect={setSelectedGameId}
            />
          ) : (
            <EmptyState text="暂无支持的游戏" />
          )}

          {games.length > 0 ? (
            tab === "技能" ? (
              <SkillsContent query={gameDetailQuery} detail={gameDetail} />
            ) : (
              <ReviewsContent
                query={reviewQuery}
                reviews={reviewQuery.data?.items ?? []}
              />
            )
          ) : null}
        </View>
      </ScrollView>

      {!isMine ? (
        <View
          style={[
            styles.actionBar,
            { paddingBottom: Math.max(insets.bottom, 12) },
          ]}
        >
          <Pressable style={styles.followButton} onPress={() => undefined}>
            <Text style={styles.followText}>关注</Text>
          </Pressable>
          <Pressable style={styles.chatButton} onPress={() => undefined}>
            <Text style={styles.chatText}>聊一聊</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function ProfileIdentity({ profile }: { profile: ProfileDetail }) {
  const status = getStatus(profile.onlineStatus, profile.gameStatus);
  const age = profile.birth ? calculateAge(profile.birth) : "";

  return (
    <View style={styles.identity}>
      <Image
        source={profile.headImage ? { uri: profile.headImage } : fallbackAvatar}
        style={styles.avatar}
        contentFit="cover"
      />
      <View style={styles.identityCopy}>
        <View style={styles.nameRow}>
          <Text numberOfLines={1} style={styles.name}>
            {profile.nickname}
          </Text>
          {profile.sex === 2 ? (
            <Image source={femaleIcon} style={styles.gender} />
          ) : null}
          {age ? (
            <Text style={profile.sex === 2 ? styles.femaleAge : styles.male}>
              {profile.sex === 2 ? "♀" : "♂"} {age}
            </Text>
          ) : null}
          {status ? (
            <View
              style={[styles.online, { backgroundColor: `${status.color}24` }]}
            >
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

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
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
              <Image source={{ uri: game.iconUrl }} style={styles.gameLogo} />
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

function SkillsContent({
  query,
  detail,
}: {
  query: { isLoading: boolean; isError: boolean; refetch: () => unknown };
  detail?: ProfileGameDetail;
}) {
  if (query.isLoading) return <InlineState text="游戏技能加载中..." />;
  if (query.isError || !detail) {
    return (
      <InlineState
        text="游戏技能加载失败"
        actionLabel="重试"
        onAction={() => void query.refetch()}
      />
    );
  }

  return (
    <>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>能力介绍</Text>
        {detail.voiceUrl ? (
          <View style={styles.voice}>
            <Text style={styles.play}>▶</Text>
            <Text style={styles.voiceText}>
              {detail.voiceDurationSeconds}&quot;
            </Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.description}>
        {detail.skillIntro || "暂无能力介绍"}
      </Text>
      <ImageGallery images={detail.images.map((image) => image.imageUrl)} />
      <Text style={[styles.sectionTitle, styles.serviceTitle]}>陪玩服务</Text>
      {detail.skillCards.length > 0 ? (
        detail.skillCards.map((card) => (
          <ServiceCard
            key={`${card.companionServiceId}-${card.gameLevelId}`}
            card={card}
          />
        ))
      ) : (
        <EmptyState text="暂无陪玩服务" />
      )}
    </>
  );
}

function ReviewsContent({
  query,
  reviews,
}: {
  query: {
    isLoading: boolean;
    isError: boolean;
    data?: { items: ProfileReview[] };
    refetch: () => unknown;
  };
  reviews: ProfileReview[];
}) {
  if (query.isLoading) return <InlineState text="评价加载中..." />;
  if (query.isError) {
    return (
      <InlineState
        text="评价加载失败"
        actionLabel="重试"
        onAction={() => void query.refetch()}
      />
    );
  }
  if (reviews.length === 0) {
    return <EmptyState text="暂无评价" hint="完成订单后会显示评价内容" />;
  }
  return (
    <View style={styles.reviewList}>
      {reviews.map((review) => (
        <ReviewCard key={review.id} review={review} />
      ))}
    </View>
  );
}

function ImageGallery({ images }: { images: string[] }) {
  if (images.length === 0) return <EmptyState text="暂无技能图片" />;
  const visibleImages = images.slice(0, 5);

  return (
    <View style={styles.gallery}>
      {visibleImages.map((image, index) => (
        <Pressable
          key={`${image}-${index}`}
          accessibilityLabel={`预览技能图片 ${index + 1}`}
          onPress={() => router.push({ pathname: "/image-preview", params: createImagePreviewParams(images, index) })}
          style={styles.galleryItem}
        >
          <Image
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

function ServiceCard({ card }: { card: ProfileSkillCard }) {
  return (
    <View style={styles.serviceCard}>
      <View style={styles.serviceCopy}>
        <Text numberOfLines={1} style={styles.serviceName}>
          {card.modeName}-{card.levelName}
        </Text>
        <View style={styles.serviceMeta}>
          <Text style={styles.price}>{card.price}</Text>
          <Text style={styles.diamond}>◇</Text>
          <Text style={styles.metaText}>订单{card.orderCount}</Text>
          {card.goodRate !== null && card.goodRate !== undefined ? (
            <Text style={styles.metaText}>{card.goodRate}%好评</Text>
          ) : null}
        </View>
      </View>
      <Pressable style={styles.orderButton} onPress={() => undefined}>
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
                onPress={() => router.push({ pathname: "/image-preview", params: createImagePreviewParams(review.imageUrls, index) })}
                style={styles.reviewImage}
              >
                <Image
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

function EmptyState({ text, hint }: { text: string; hint?: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>{text}</Text>
      {hint ? <Text style={styles.emptyHint}>{hint}</Text> : null}
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
  if (onlineStatus === 1) return { label: "空闲中", color: "#19D58B" };
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
  navButton: { width: 24, height: 24 },
  backIcon: { width: 24, height: 24, tintColor: "#fff" },
  settingsIcon: { width: 24, height: 24, tintColor: "#fff" },
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
  identityCopy: { flex: 1, minWidth: 0, gap: 6 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  name: {
    flexShrink: 1,
    color: "#fff",
    fontFamily: DOUYIN_SANS,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "600",
  },
  gender: { width: 15, height: 15 },
  male: {
    flexShrink: 0,
    color: "#1AA9FF",
    backgroundColor: "rgba(28,78,108,0.5)",
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 1,
    fontSize: 12,
  },
  femaleAge: {
    flexShrink: 0,
    color: "#FF4770",
    backgroundColor: "rgba(108,28,63,0.5)",
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 1,
    fontSize: 12,
  },
  online: {
    flexShrink: 0,
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  onlineText: { fontFamily: DOUYIN_SANS, fontSize: 12 },
  clubLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  clubIcon: { width: 14, height: 14, tintColor: "#D7DCE2" },
  club: {
    flexShrink: 1,
    color: "#C9CED4",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
  },
  content: {
    marginTop: -1,
    paddingHorizontal: 16,
    backgroundColor: "#fff",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingTop: 16,
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
  gameLogo: { width: 20, height: 20, borderRadius: 4 },
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
  voice: {
    height: 24,
    paddingHorizontal: 6,
    borderRadius: 12,
    backgroundColor: "#FF3158",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  play: {
    color: "#FF3158",
    backgroundColor: "#fff",
    width: 17,
    height: 17,
    borderRadius: 9,
    textAlign: "center",
    lineHeight: 17,
    fontSize: 8,
  },
  voiceText: { color: "#fff", fontSize: 12 },
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
  reviewList: { marginHorizontal: -16, marginTop: 8 },
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
