import { ChevronLeft24Regular, Search24Regular } from "@fluentui/react-native-icons";
import { useAuthStore } from "@esports/auth";
import { useVoicePlayer } from "@/shared/audio/use-voice-player";
import { VoicePlayButton } from "@/shared/audio/VoicePlayButton";
import { DOUYIN_SANS } from "@/shared/theme/typography";
import { EmptyState, ErrorState } from "@/shared/ui/AsyncStates";
import { CachedImage } from "@/shared/ui/CachedImage";
import {
  ClubDetailMemberSkeletonList,
  ClubDetailSkeleton,
} from "@/features/home/components/ClubDetailSkeleton";
import { ClubQuickMatchSheet } from "@/features/match/components/ClubQuickMatchSheet";
import { useCustomerDispatch } from "@/features/voice-room/use-customer-dispatch";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Toast from "react-native-root-toast";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Companion, CompanionFilters, GameKey } from "../api/home.types";
import {
  useClubCompanions,
  useClubDetail,
  useClubGameModes,
} from "../hooks/use-home-data";

const tabLeftCorner = require("../../../../assets/home/h_tab_left.svg");
const tabRightCorner = require("../../../../assets/home/h_tab_right.svg");
const maleIcon = require("../../../../assets/home/club-detail/male.svg");
const femaleIcon = require("../../../../assets/home/club-detail/female.svg");
const memberIcon = require("../../../../assets/coms/user.svg");
const filterArrowIcon = require("../../../../assets/home/club-detail/arrow-fill-down.svg");
const idleIcon = require("../../../../assets/home/club-detail/status-idle.svg");
const playingIcon = require("../../../../assets/home/club-detail/status-playing.svg");
const diamondIcon = require("../../../../assets/home/club-detail/icon-diamond.svg");
const emptyStateIllustration = require("../../../../assets/coms/empty-state-illustration.svg");

type FilterKey = "gender" | "mode" | "status" | "price";
const filterDefinitions: { key: FilterKey; label: string }[] = [
  { key: "gender", label: "性别" },
  { key: "mode", label: "模式" },
  { key: "status", label: "状态" },
  { key: "price", label: "价格" },
];

const memberKeyExtractor = (member: Companion) => String(member.profileId);

export default function ClubDetailScreen() {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [game, setGame] = useState<GameKey>("");
  const [openFilter, setOpenFilter] = useState<FilterKey | null>(null);
  const [isFilterSheetVisible, setFilterSheetVisible] = useState(false);
  const [showPriceEmptyModal, setShowPriceEmptyModal] = useState(false);
  const [quickMatchVisible, setQuickMatchVisible] = useState(false);
  const accessToken = useAuthStore((state) => state.accessToken);
  const { dispatch: dispatchReception } = useCustomerDispatch();
  const [priceSort, setPriceSort] =
    useState<CompanionFilters["priceSort"]>("DEFAULT");
  const [selectedSex, setSelectedSex] = useState<CompanionFilters["sex"]>();
  const [selectedStatus, setSelectedStatus] =
    useState<CompanionFilters["gameStatus"]>();
  const [selectedMode, setSelectedMode] = useState<number>();
  const clubQuery = useClubDetail(id);
  const club = clubQuery.data;
  const games = club?.games ?? [];
  const selectedGame = game || String(games[0]?.id ?? "");
  const modesQuery = useClubGameModes(selectedGame);
  const selectedModeLabel = modesQuery.data?.find(
    (mode) => mode.id === selectedMode,
  )?.modeName;
  const companionFilters = useMemo<CompanionFilters | null>(
    () =>
      club && selectedGame
        ? {
            clubId: club.id,
            gameId: selectedGame,
            priceSort,
            sex: selectedSex,
            gameStatus: selectedStatus,
            // 空闲中=gameStatus 0 且必须在线；离线用户仅在状态不限时展示。
            onlineOnly: selectedStatus === 0 ? true : undefined,
            gameModeId: selectedMode,
          }
        : null,
    [club, priceSort, selectedGame, selectedMode, selectedSex, selectedStatus],
  );
  const companionsQuery = useClubCompanions(companionFilters);
  const members = useMemo(
    () => companionsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [companionsQuery.data],
  );
  const voicePlayer = useVoicePlayer();
  const clubId = club?.id ?? "";
  const quickMatchClub = useMemo(
    () =>
      club
        ? { id: club.id, name: club.name }
        : { id: "", name: "" },
    [club?.id, club?.name],
  );
  const renderMember = useCallback(
    ({ item }: { item: Companion }) => (
      <MemberCard
        clubId={clubId}
        userId={item.userId}
        image={item.headImage}
        name={item.nickname}
        description={item.signature}
        gender={item.sex === 1 ? "male" : "female"}
        price={item.price}
        orderCount={item.orderCount}
        voiceDuration={item.voiceDurationSeconds}
        voiceUrl={item.voiceUrl}
        voicePlaying={voicePlayer.playingUrl === item.voiceUrl}
        onToggleVoice={voicePlayer.toggle}
        status={
          item.gameStatus === 1
            ? "游戏中"
            : item.onlineStatus === 1
              ? "空闲中"
              : undefined
        }
        statusColor={
          item.gameStatus === 1
            ? "#1e5eff"
            : item.onlineStatus === 1
              ? "#16c978"
              : undefined
        }
      />
    ),
    [clubId, voicePlayer.playingUrl, voicePlayer.toggle],
  );
  const [filterBackdropOpacity] = useState(() => new Animated.Value(0));
  const [filterSheetTranslateY] = useState(
    () => new Animated.Value(windowHeight),
  );
  const isFilterSheetClosing = useRef(false);

  useEffect(() => {
    if (!isFilterSheetVisible) return;

    filterBackdropOpacity.setValue(0);
    filterSheetTranslateY.setValue(windowHeight);
    const animation = Animated.parallel([
      Animated.timing(filterBackdropOpacity, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(filterSheetTranslateY, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    animation.start();
    return () => animation.stop();
  }, [
    filterBackdropOpacity,
    filterSheetTranslateY,
    isFilterSheetVisible,
    windowHeight,
  ]);

  function openFilterSheet(filter: FilterKey) {
    if (isFilterSheetVisible) return;
    isFilterSheetClosing.current = false;
    setOpenFilter(filter);
    setFilterSheetVisible(true);
  }

  function closeFilterSheet() {
    if (!isFilterSheetVisible || isFilterSheetClosing.current) return;
    isFilterSheetClosing.current = true;
    Animated.parallel([
      Animated.timing(filterBackdropOpacity, {
        toValue: 0,
        duration: 160,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(filterSheetTranslateY, {
        toValue: windowHeight,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (!finished) return;
      setFilterSheetVisible(false);
      setOpenFilter(null);
      isFilterSheetClosing.current = false;
    });
  }

  if (clubQuery.isLoading)
    return (
      <ClubDetailSkeleton
        topInset={insets.top}
        bottomInset={insets.bottom}
      />
    );
  if (clubQuery.isError || !club)
    return <ErrorState onRetry={() => void clubQuery.refetch()} />;
  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <LinearGradient
        colors={["#3b6f75", "#2a6681"]}
        end={{ x: 1, y: 0.8 }}
        start={{ x: 0, y: 0 }}
        style={[styles.header, { paddingTop: insets.top }]}
      >
        <View style={[styles.nav, { height: 44 }]}>
          <Pressable
            accessibilityLabel="返回"
            hitSlop={10}
            onPress={() => router.back()}
          >
            <ChevronLeft24Regular color="white" width={24} height={24} style={styles.navIconImage} />
          </Pressable>
          <View style={styles.navTitleSpacer} />
          <View style={styles.navActions}>
            <Pressable
              accessibilityLabel="搜索"
              hitSlop={10}
              onPress={() =>
                router.push({
                  pathname: "/search",
                  params: { type: "user", clubId: club.id },
                })
              }
            >
              <Search24Regular color="white" width={24} height={24} style={styles.navIconImage} />
            </Pressable>
          </View>
        </View>
        <View style={styles.clubInfo}>
          <CachedImage
            source={club.logoUrl ? { uri: club.logoUrl } : undefined}
            style={styles.clubLogo}
            contentFit="cover"
          />
          <View style={styles.clubCopy}>
            <View style={styles.titleLine}>
              <Text numberOfLines={1} style={styles.clubName}>
                {club.name}
              </Text>
              <Text style={styles.selfTag}>自营</Text>
              <View style={styles.clubMeta}>
                <Image source={memberIcon} style={styles.clubMetaIcon} />
                <Text style={styles.metaText}>{club.memberCount}</Text>
              </View>
            </View>

            <Text numberOfLines={1} style={styles.clubDescription}>
              {club.intro}
            </Text>
          </View>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.gameTabs}
          contentContainerStyle={styles.gameTabsContent}
        >
          {games.map((item, index) => (
            <GameTab
              key={item.id}
              label={item.name}
              iconUrl={item.iconUrl}
              first={index === 0}
              active={selectedGame === String(item.id)}
              onPress={() => {
                setGame(String(item.id));
                setSelectedMode(undefined);
              }}
            />
          ))}
        </ScrollView>
      </LinearGradient>
      <View style={styles.filterRow}>
        {filterDefinitions.map(({ key, label }) => {
          const displayLabel =
            key === "gender"
              ? selectedSex === 1
                ? "男"
                : selectedSex === 2
                  ? "女"
                  : label
              : key === "mode"
                ? selectedModeLabel || label
                : key === "status"
                  ? selectedStatus === 0
                    ? "空闲中"
                    : selectedStatus === 1
                      ? "游戏中"
                      : label
                  : priceSort === "ASC"
                    ? "从低到高"
                    : priceSort === "DESC"
                      ? "从高到低"
                      : label;
          const hasSelection = displayLabel !== label;
          const filterDisplay = hasSelection
            ? `${label} ${displayLabel}`
            : label;
          return (
            <Pressable
              key={key}
              accessibilityLabel={`筛选${label}`}
              style={[
                styles.filterItem,
                openFilter === key && styles.filterItemActive,
              ]}
              onPress={() => openFilterSheet(key)}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.filterText,
                  hasSelection && styles.filterTextSelected,
                ]}
              >
                {filterDisplay}
              </Text>
              <Image source={filterArrowIcon} style={styles.filterArrowIcon} />
            </Pressable>
          );
        })}
      </View>
      <Modal
        transparent
        visible={isFilterSheetVisible}
        animationType="none"
        onRequestClose={closeFilterSheet}
      >
        <Animated.View
          style={[styles.filterBackdrop, { opacity: filterBackdropOpacity }]}
        >
          <Pressable
            accessibilityLabel="关闭筛选弹窗"
            onPress={closeFilterSheet}
            style={StyleSheet.absoluteFill}
          />
          <Animated.View
            style={[
              styles.filterSheet,
              { transform: [{ translateY: filterSheetTranslateY }] },
            ]}
          >
            <View style={styles.filterSheetHeader}>
              <Text style={styles.filterSheetTitle}>
                {
                  filterDefinitions.find((item) => item.key === openFilter)
                    ?.label
                }
              </Text>
              <Pressable onPress={closeFilterSheet}>
                <Text style={styles.filterClose}>×</Text>
              </Pressable>
            </View>
            {openFilter === "gender" && (
              <>
                <FilterOption
                  label="不限"
                  selected={!selectedSex}
                  onPress={() => {
                    setSelectedSex(undefined);
                    closeFilterSheet();
                  }}
                />
                <FilterOption
                  label="男"
                  selected={selectedSex === 1}
                  onPress={() => {
                    setSelectedSex(1);
                    closeFilterSheet();
                  }}
                />
                <FilterOption
                  label="女"
                  selected={selectedSex === 2}
                  onPress={() => {
                    setSelectedSex(2);
                    closeFilterSheet();
                  }}
                />
              </>
            )}
            {openFilter === "mode" && (
              <>
                <FilterOption
                  label="不限"
                  selected={!selectedMode}
                  onPress={() => {
                    setSelectedMode(undefined);
                    closeFilterSheet();
                  }}
                />
                {modesQuery.data?.map((mode) => (
                  <FilterOption
                    key={mode.id}
                    label={mode.modeName}
                    selected={selectedMode === mode.id}
                    onPress={() => {
                      setSelectedMode(mode.id);
                      closeFilterSheet();
                    }}
                  />
                ))}
              </>
            )}
            {openFilter === "status" && (
              <>
                <FilterOption
                  label="不限"
                  selected={selectedStatus === undefined}
                  onPress={() => {
                    setSelectedStatus(undefined);
                    closeFilterSheet();
                  }}
                />
                <FilterOption
                  label="空闲中"
                  selected={selectedStatus === 0}
                  onPress={() => {
                    setSelectedStatus(0);
                    closeFilterSheet();
                  }}
                />
                <FilterOption
                  label="游戏中"
                  selected={selectedStatus === 1}
                  onPress={() => {
                    setSelectedStatus(1);
                    closeFilterSheet();
                  }}
                />
              </>
            )}
            {openFilter === "price" && (
              <>
                <FilterOption
                  label="默认排序"
                  selected={priceSort === "DEFAULT"}
                  onPress={() => {
                    setPriceSort("DEFAULT");
                    closeFilterSheet();
                  }}
                />
                <FilterOption
                  label="从高到低"
                  selected={priceSort === "DESC"}
                  onPress={() => {
                    setPriceSort("DESC");
                    closeFilterSheet();
                  }}
                />
                <FilterOption
                  label="从低到高"
                  selected={priceSort === "ASC"}
                  onPress={() => {
                    setPriceSort("ASC");
                    closeFilterSheet();
                  }}
                />
              </>
            )}
          </Animated.View>
        </Animated.View>
      </Modal>
      <Modal
        transparent
        visible={showPriceEmptyModal}
        animationType="fade"
        onRequestClose={() => setShowPriceEmptyModal(false)}
      >
        <Pressable
          accessibilityLabel="关闭暂无价目表提示"
          accessibilityRole="button"
          onPress={() => setShowPriceEmptyModal(false)}
          style={styles.priceEmptyBackdrop}
        >
          <Pressable style={styles.priceEmptyCard} onPress={() => undefined}>
            <Pressable
              accessibilityLabel="关闭"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => setShowPriceEmptyModal(false)}
              style={styles.priceEmptyClose}
            >
              <Text style={styles.priceEmptyCloseText}>×</Text>
            </Pressable>
            <Image
              accessibilityIgnoresInvertColors
              contentFit="contain"
              source={emptyStateIllustration}
              style={styles.priceEmptyIllustration}
            />
            <Text style={styles.priceEmptyTitle}>暂无价目表</Text>
            <Text style={styles.priceEmptyHint}>
              该俱乐部暂未发布价目表，请稍后再来看看
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowPriceEmptyModal(false)}
              style={({ pressed }) => [
                styles.priceEmptyButton,
                pressed && styles.priceEmptyButtonPressed,
              ]}
            >
              <Text style={styles.priceEmptyButtonText}>知道了</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
      <FlatList
        data={members}
        keyExtractor={memberKeyExtractor}
        renderItem={renderMember}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 92 + insets.bottom }}
        style={styles.listScroll}
        ListEmptyComponent={
          companionsQuery.isLoading ? (
            <ClubDetailMemberSkeletonList />
          ) : (
            <EmptyState message="暂无大神" style={styles.memberEmpty} />
          )
        }
      />
      <View
        style={[
          styles.bottomBar,
          { paddingBottom: Math.max(insets.bottom, 12) },
        ]}
      >
        <Pressable
          style={styles.priceButton}
          onPress={() => {
            if (!club.pageConfigGroupId) {
              setShowPriceEmptyModal(true);
              return;
            }
            router.push({
              pathname: "/club/price-list",
              params: { groupId: club.pageConfigGroupId },
            });
          }}
        >
          <Text style={styles.priceText}>价目表</Text>
        </Pressable>
        <Pressable
          style={styles.actionButton}
          onPress={() => {
            void dispatchReception({ clubId: club?.id });
          }}
        >
          <Text style={styles.actionButtonText}>接待派单</Text>
        </Pressable>
        <Pressable
          style={styles.actionButton}
          onPress={() => {
            if (!accessToken) {
              Toast.show("请先登录", { duration: Toast.durations.SHORT });
              return;
            }
            setQuickMatchVisible(true);
          }}
        >
          <Text style={styles.actionButtonText}>一键匹配</Text>
        </Pressable>
      </View>
      <ClubQuickMatchSheet
        visible={quickMatchVisible}
        onClose={() => setQuickMatchVisible(false)}
        club={quickMatchClub}
        games={games.map((g) => ({
          id: String(g.id),
          name: g.name,
          iconUrl: g.iconUrl,
        }))}
        initialGameId={selectedGame || undefined}
      />
    </View>
  );
}

function GameTab({
  label,
  iconUrl,
  first,
  active,
  onPress,
}: {
  label: string;
  iconUrl?: string;
  first: boolean;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.gameTab,
        first && styles.gameTabFirst,
        active && styles.gameTabActive,
        active && !first && styles.gameTabActiveAfterFirst,
      ]}
    >
      <View style={styles.gameLogo}>
        {iconUrl ? (
          <CachedImage source={{ uri: iconUrl }} style={styles.gameIcon} />
        ) : (
          <Text style={styles.gameTriangle}>△</Text>
        )}
      </View>
      <Text style={[styles.gameLabel, active && styles.gameLabelActive]}>
        {label}
      </Text>
      {active && (
        <>
          <View style={styles.gameIndicator} />
          <Image
            source={tabLeftCorner}
            style={[styles.tabCorner, styles.tabCornerLeft]}
            pointerEvents="none"
          />
          <Image
            source={tabRightCorner}
            style={[styles.tabCorner, styles.tabCornerRight]}
            pointerEvents="none"
          />
        </>
      )}
    </Pressable>
  );
}

function FilterOption({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={styles.filterOption}
    >
      <Text
        style={[
          styles.filterOptionText,
          selected && styles.filterOptionTextSelected,
        ]}
      >
        {label}
      </Text>
      {selected && <Text style={styles.filterCheck}>✓</Text>}
    </Pressable>
  );
}

const MemberCard = memo(function MemberCard({
  clubId,
  userId,
  image,
  name,
  description,
  gender,
  price,
  orderCount,
  voiceDuration,
  voiceUrl,
  voicePlaying,
  onToggleVoice,
  status,
  statusColor,
}: {
  clubId: string;
  userId: number;
  image?: string;
  name: string;
  description?: string;
  gender: "male" | "female";
  price: number;
  orderCount: number;
  voiceDuration?: number;
  voiceUrl?: string;
  voicePlaying: boolean;
  onToggleVoice: (voiceUrl: string) => void;
  status?: string;
  statusColor?: string;
}) {
  const isPlaying = status === "游戏中";
  return (
    <Pressable
      style={styles.memberCard}
      onPress={() =>
        router.push({
          pathname: "/profile",
          params: { clubId, userId: String(userId) },
        })
      }
    >
      <View style={styles.avatarWrap}>
        <CachedImage
          source={image ? { uri: image } : undefined}
          contentFit="cover"
          style={styles.avatar}
        />
        {voiceUrl ? (
          <VoicePlayButton
            compact
            duration={voiceDuration}
            onToggleVoice={onToggleVoice}
            playingUrl={voicePlaying ? voiceUrl : null}
            url={voiceUrl}
          />
        ) : null}
      </View>
      <View style={styles.memberBody}>
        <View style={styles.memberTitle}>
          <Text numberOfLines={1} style={styles.memberName}>
            {name}
          </Text>
          <View style={styles.genderGroup}>
            <Image
              source={gender === "male" ? maleIcon : femaleIcon}
              style={styles.genderIcon}
            />
          </View>
          {status && statusColor && (
            <View
              style={[styles.status, { backgroundColor: `${statusColor}20` }]}
            >
              <Image
                source={isPlaying ? playingIcon : idleIcon}
                style={styles.statusIcon}
              />
              <Text
                numberOfLines={1}
                style={[styles.statusText, { color: statusColor }]}
              >
                {status}
              </Text>
            </View>
          )}
        </View>
        <Text numberOfLines={2} style={styles.memberDesc}>
          {description || "暂无个人简介"}
        </Text>
        <View style={styles.priceRow}>
          <Text style={styles.price}>{price}</Text>
          <Image source={diamondIcon} style={styles.diamondIcon} />
          <Text style={styles.orders}>{orderCount}订单</Text>
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
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
  retryText: { color: "#ff3158", fontFamily: DOUYIN_SANS, fontSize: 14 },
  gameTabsContent: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 4,
  },
  gameIcon: { width: 16, height: 16, borderRadius: 3 },
  gameIndicator: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: "#fff",
  },
  tabCorner: { position: "absolute", width: 17, height: 17, bottom: -1 },
  tabCornerLeft: { left: -15 },
  tabCornerRight: { right: -15 },
  navIconImage: { width: 24, height: 24 },
  genderIcon: { width: 12, height: 12 },
  genderGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    flexShrink: 0,
  },
  maleGender: { color: "#0095ee" },
  statusIcon: { width: 12, height: 12 },
  diamondIcon: { width: 15, height: 15, marginLeft: 4 },
  screen: { flex: 1, backgroundColor: "#fff" },
  header: { width: "100%" },
  nav: {
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  back: { color: "#fff", fontSize: 44, fontWeight: "200", lineHeight: 38 },
  navTitleSpacer: { flex: 1 },
  navActions: { width: 32, alignItems: "flex-end" },
  navIcon: { color: "#fff", fontSize: 29, lineHeight: 26 },
  clubInfo: {
    minHeight: 104,
    paddingTop: 8,
    paddingBottom: 24,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  clubLogo: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: "#162a36",
  },
  clubCopy: { flex: 1, minWidth: 0, gap: 6 },
  titleLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  selfTag: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    backgroundColor: "#ff3158",
    color: "#fff",
    fontFamily: DOUYIN_SANS,
    fontSize: 10,
    fontWeight: "700",
  },
  clubName: {
    flexShrink: 1,
    color: "#fff",
    fontFamily: DOUYIN_SANS,
    fontSize: 16,
    fontWeight: "600",
  },
  clubMeta: { flexDirection: "row", alignItems: "center", gap: 2 },
  clubMetaIcon: { width: 14, height: 14, opacity: 0.65 },
  metaText: {
    color: "rgba(255,255,255,.6)",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    lineHeight: 18,
  },
  clubDescription: {
    color: "rgba(255,255,255,.6)",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    lineHeight: 18,
  },
  gameTabs: { height: 40, flexDirection: "row" },
  gameTab: {
    height: 40,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderTopRightRadius: 12,
  },
  gameTabFirst: { borderTopLeftRadius: 0 },
  gameTabActive: { backgroundColor: "#fff" },
  gameTabActiveAfterFirst: { borderTopLeftRadius: 12 },
  gameLogo: {
    width: 16,
    height: 16,
    borderRadius: 3,
    backgroundColor: "#082d35",
    alignItems: "center",
    justifyContent: "center",
  },
  gameTriangle: { color: "#19e5a5", fontSize: 15, lineHeight: 16 },
  gameLabel: {
    flexShrink: 0,
    color: "#fff",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
  },
  gameLabelActive: { color: "#111", fontWeight: "600" },
  filterRow: {
    height: 42,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  filterItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    minHeight: 34,
    borderRadius: 4,
    minWidth: 0,
    paddingHorizontal: 4,
  },
  filterItemActive: { backgroundColor: "#f5f5f5" },
  filterText: {
    flexShrink: 1,
    color: "#666",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
  },
  filterTextSelected: { color: "#0A0A0A", fontWeight: "600" },
  filterArrowIcon: { width: 12, height: 12 },
  filterBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,.35)",
  },
  filterSheet: {
    maxHeight: "65%",
    paddingBottom: 28,
    backgroundColor: "#fff",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  filterSheetHeader: {
    height: 52,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ebebeb",
  },
  filterSheetTitle: {
    color: "#111",
    fontFamily: DOUYIN_SANS,
    fontSize: 16,
    fontWeight: "600",
  },
  filterClose: {
    width: 32,
    color: "#666",
    fontSize: 26,
    lineHeight: 32,
    textAlign: "center",
  },
  filterOption: {
    height: 48,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  filterOptionText: { color: "#333", fontFamily: DOUYIN_SANS, fontSize: 14 },
  filterOptionTextSelected: { color: "#ff3158", fontWeight: "600" },
  filterCheck: { color: "#ff3158", fontSize: 17, fontWeight: "700" },
  priceEmptyBackdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    backgroundColor: "rgba(12, 18, 28, .52)",
  },
  priceEmptyCard: {
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
    borderRadius: 20,
    backgroundColor: "#fff",
    shadowColor: "#101828",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 8,
  },
  priceEmptyClose: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "#f6f7f9",
  },
  priceEmptyCloseText: {
    color: "#8d95a3",
    fontSize: 23,
    fontWeight: "300",
    lineHeight: 25,
  },
  priceEmptyIllustration: { width: 112, height: 112, marginBottom: 8 },
  priceEmptyTitle: {
    color: "#171a21",
    fontFamily: DOUYIN_SANS,
    fontSize: 18,
    lineHeight: 26,
    fontWeight: "600",
  },
  priceEmptyHint: {
    marginTop: 6,
    color: "#8b929e",
    fontFamily: DOUYIN_SANS,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
  priceEmptyButton: {
    width: "100%",
    height: 44,
    marginTop: 22,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: "#ff3158",
  },
  priceEmptyButtonPressed: { opacity: 0.82 },
  priceEmptyButtonText: {
    color: "#fff",
    fontFamily: DOUYIN_SANS,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
  },
  listScroll: { flex: 1 },
  list: { paddingHorizontal: 0 },
  memberEmpty: { alignSelf: "center", marginTop: 24 },
  memberCard: {
    minHeight: 124,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    gap: 12,
  },
  avatarWrap: { width: 100, height: 100, position: "relative" },
  avatar: { width: 106, height: 106, borderRadius: 8 },
  memberBody: { flex: 1, minWidth: 0, marginLeft: 8 },
  memberTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minWidth: 0,
  },
  memberName: {
    flexShrink: 1,
    color: "#111",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    fontWeight: "500",
  },
  gender: {
    flexShrink: 0,
    color: "#ff4770",
    fontSize: 12,
    fontWeight: 500,
  },
  status: {
    marginLeft: "auto",
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    minHeight: 18,
    maxHeight: 18,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
  },
  statusText: { fontFamily: DOUYIN_SANS, fontSize: 10, lineHeight: 14 },
  memberDesc: {
    marginTop: 4,
    color: "#777",
    fontSize: 14,
    fontWeight: 400,
    lineHeight: 19,
  },
  priceRow: { marginTop: 17, flexDirection: "row", alignItems: "center" },
  price: {
    color: "#ff3158",
    fontFamily: DOUYIN_SANS,
    fontSize: 20,
    fontWeight: "700",
  },
  diamond: { marginLeft: 5, color: "#ff3158", fontSize: 15 },
  orders: {
    marginLeft: "auto",
    color: "#999",
    fontSize: 12,
    fontWeight: 400,
  },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 76,
    paddingHorizontal: 12,
    paddingTop: 8,
    backgroundColor: "#fff",
    flexDirection: "row",
    gap: 8,
  },
  priceButton: {
    flex: 1,
    height: 42,
    minWidth: 104,
    borderWidth: 1,
    borderColor: "#e9e9eb",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  priceText: {
    color: "#0D0D0F",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    fontWeight: "500",
  },
  actionButton: {
    flex: 1,
    height: 42,
    minWidth: 104,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fe1f4c",
  },
  actionButtonText: {
    color: "#fff",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    fontWeight: "500",
  },
});
