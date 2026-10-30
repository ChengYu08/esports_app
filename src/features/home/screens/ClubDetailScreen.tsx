import { ChevronLeft24Regular, Headset24Regular, Search24Regular } from "@fluentui/react-native-icons";
import { useAuthStore } from "@esports/auth";
import { useQuery } from "@tanstack/react-query";
import { useVoicePlayer } from "@/shared/audio/use-voice-player";
import { VoicePlayButton } from "@/shared/audio/VoicePlayButton";
import { SYSTEM_FONT } from "@/shared/theme/typography";
import { EmptyState, ErrorState } from "@/shared/ui/AsyncStates";
import { CachedImage } from "@/shared/ui/CachedImage";
import { fetchClubGameLevels } from "@/features/match/api/match.api";
import {
  ClubDetailMemberSkeletonList,
  ClubDetailSkeleton,
} from "@/features/home/components/ClubDetailSkeleton";
import { ClubQuickMatchSheet } from "@/features/match/components/ClubQuickMatchSheet";
import { useCustomerServiceEntry } from "@/features/mine/hooks/use-customer-service-entry";
import { Image } from "expo-image";
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

// 切图资源（新设计稿：俱乐部主页 455-68151 / 490-84520 / 557-88105）
const bgClubImage = require("../../../../assets/home/club-detail/bg-club.png");
const tabCornerIcon = require("../../../../assets/home/club-detail/tab-corner.svg");
const arrowDownIcon = require("../../../../assets/home/club-detail/arrow-fill-down-new.svg");
const arrowUpRedIcon = require("../../../../assets/home/club-detail/arrow-fill-up-red.svg");
const statusPlayingIcon = require("../../../../assets/home/club-detail/status-playing-new.svg");
const statusIdleIcon = require("../../../../assets/home/club-detail/status-idle-new.svg");
const introToggleIcon = require("../../../../assets/home/club-detail/intro-toggle.svg");
const maleIcon = require("../../../../assets/home/club-detail/male.svg");
const femaleIcon = require("../../../../assets/home/club-detail/female.svg");
const diamondIcon = require("../../../../assets/home/club-detail/icon-diamond.svg");
const emptyStateIllustration = require("../../../../assets/coms/empty-state-illustration.svg");

// 设计稿色板
const COLORS = {
  brand: "#FE1F4C",
  brandLight: "#FE4267",
  textDark: "#0D0D0F",
  textTitle: "#0A0A0A",
  textSecondary: "#656566",
  textTertiary: "#979799",
  textQuaternary: "#7F7F80",
  white: "#FFFFFF",
  white60: "rgba(255, 255, 255, 0.6)",
  orangeBg: "#FFF4EB",
  orangeText: "#F5821D",
  gameTagText: "#B25C15",
  greenBg: "#E6FAEF",
  greenText: "#14A357",
  border: "#E9E9EB",
} as const;

type FilterKey = "mode" | "level" | "gender" | "advanced";
const filterDefinitions: { key: FilterKey; label: string }[] = [
  { key: "mode", label: "模式" },
  { key: "level", label: "等级" },
  { key: "gender", label: "性别" },
  { key: "advanced", label: "筛选" },
];

type MemberStatus = "playing" | "idle";

const memberKeyExtractor = (member: Companion) => String(member.profileId);

export default function ClubDetailScreen() {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [game, setGame] = useState<GameKey>("");
  // 简介展开状态：默认收起两行，点击右下角按钮切换
  const [introExpanded, setIntroExpanded] = useState(false);
  const [openFilter, setOpenFilter] = useState<FilterKey | null>(null);
  const [isFilterSheetVisible, setFilterSheetVisible] = useState(false);
  const [showPriceEmptyModal, setShowPriceEmptyModal] = useState(false);
  const [quickMatchVisible, setQuickMatchVisible] = useState(false);
  const accessToken = useAuthStore((state) => state.accessToken);
  const { openCustomerService } = useCustomerServiceEntry();
  const [priceSort, setPriceSort] =
    useState<CompanionFilters["priceSort"]>("DEFAULT");
  const [selectedSex, setSelectedSex] = useState<CompanionFilters["sex"]>();
  const [selectedStatus, setSelectedStatus] =
    useState<CompanionFilters["gameStatus"]>();
  const [selectedMode, setSelectedMode] = useState<number>();
  const [selectedLevel, setSelectedLevel] = useState<number>();
  const clubQuery = useClubDetail(id);
  const club = clubQuery.data;
  const games = club?.games ?? [];
  const selectedGame = game || String(games[0]?.id ?? "");
  const selectedGameInfo = games.find((item) => String(item.id) === selectedGame);
  const modesQuery = useClubGameModes(selectedGame);
  // 等级列表依赖已选模式（接口按 gameModeId 查询），且需要登录态
  const levelsQuery = useQuery({
    queryKey: ["club-game-levels", selectedMode, accessToken],
    queryFn: ({ signal }) =>
      fetchClubGameLevels(String(selectedMode), accessToken as string, signal),
    enabled: Boolean(selectedMode && accessToken),
  });
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
            gameLevelId: selectedLevel,
          }
        : null,
    [
      club,
      priceSort,
      selectedGame,
      selectedLevel,
      selectedMode,
      selectedSex,
      selectedStatus,
    ],
  );
  const companionsQuery = useClubCompanions(companionFilters);
  const members = useMemo(
    () => companionsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [companionsQuery.data],
  );
  const voicePlayer = useVoicePlayer();
  const clubId = club?.id ?? "";
  const quickMatchClub = useMemo(
    () => (club ? { id: club.id, name: club.name } : { id: "", name: "" }),
    [club],
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
        // 游戏角标跟列表所选游戏一致（列表本身按该游戏过滤）
        gameName={selectedGameInfo?.name}
        gameIconUrl={selectedGameInfo?.iconUrl}
        status={
          item.gameStatus === 1
            ? "playing"
            : item.onlineStatus === 1
              ? "idle"
              : undefined
        }
      />
    ),
    [clubId, selectedGameInfo?.iconUrl, selectedGameInfo?.name, voicePlayer.playingUrl, voicePlayer.toggle],
  );
  const [filterBackdropOpacity] = useState(() => new Animated.Value(0));
  const [filterSheetTranslateY] = useState(
    () => new Animated.Value(windowHeight),
  );
  const isFilterSheetClosing = useRef(false);

  useEffect(() => {
    if (!isFilterSheetVisible) {
      return;
    }
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
    if (isFilterSheetVisible) {
      return;
    }
    isFilterSheetClosing.current = false;
    setOpenFilter(filter);
    setFilterSheetVisible(true);
  }

  function closeFilterSheet() {
    if (!isFilterSheetVisible || isFilterSheetClosing.current) {
      return;
    }
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
      if (!finished) {
        return;
      }
      setFilterSheetVisible(false);
      setOpenFilter(null);
      isFilterSheetClosing.current = false;
    });
  }

  function handleSelectGame(nextGameId: string) {
    setGame(nextGameId);
    // 切换游戏后模式/等级需要重新选择
    setSelectedMode(undefined);
    setSelectedLevel(undefined);
  }

  if (clubQuery.isLoading) {
    return (
      <ClubDetailSkeleton
        topInset={insets.top}
        bottomInset={insets.bottom}
      />
    );
  }
  if (clubQuery.isError || !club) {
    return <ErrorState onRetry={() => void clubQuery.refetch()} />;
  }
  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      {/* 顶部整屏背景切图（设计稿 top bg-club） */}
      <Image
        source={bgClubImage}
        style={[styles.background, { height: windowHeight }]}
        contentFit="cover"
        pointerEvents="none"
      />
      {/* 导航栏：返回 + 搜索 + 客服 */}
      <View style={[styles.nav, { paddingTop: insets.top }]}>
        <Pressable
          accessibilityLabel="返回"
          hitSlop={10}
          onPress={() => router.back()}
        >
          <ChevronLeft24Regular color={COLORS.white} width={24} height={24} />
        </Pressable>
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
            <Search24Regular color={COLORS.white} width={24} height={24} />
          </Pressable>
          <Pressable
            accessibilityLabel="在线客服"
            hitSlop={10}
            onPress={openCustomerService}
          >
            <Headset24Regular color={COLORS.white} width={24} height={24} />
          </Pressable>
        </View>
      </View>
      {/* 俱乐部信息区（毛玻璃面板，圆角 12 顶部） */}
      <View style={styles.infoSection}>
        <View style={styles.infoMain}>
          <CachedImage
            source={club.logoUrl ? { uri: club.logoUrl } : undefined}
            style={styles.clubLogo}
            contentFit="cover"
          />
          <View style={styles.clubCopy}>
            <View style={styles.clubTitleRow}>
              <Text numberOfLines={1} style={styles.clubName}>
                {club.name}
              </Text>
              <Text style={styles.selfTag}>自营</Text>
            </View>
            <View style={styles.clubMetaRow}>
              <View style={styles.clubMetaItem}>
                <Text style={styles.clubMetaLabel}>成员</Text>
                <Text style={styles.clubMetaValue}>{club.memberCount}人</Text>
              </View>
              <View style={styles.clubMetaItem}>
                <Text style={styles.clubMetaLabel}>俱乐部ID</Text>
                <Text style={styles.clubMetaValue}>{club.id}</Text>
              </View>
            </View>
          </View>
        </View>
        <View style={styles.introBlock}>
          <Text
            numberOfLines={introExpanded ? undefined : 2}
            style={styles.introText}
          >
            {club.intro}
          </Text>
          <Pressable
            accessibilityLabel={introExpanded ? "收起简介" : "展开简介"}
            hitSlop={6}
            style={styles.introToggle}
            onPress={() => setIntroExpanded(!introExpanded)}
          >
            <Image
              source={introToggleIcon}
              style={[
                styles.introToggleIcon,
                introExpanded && styles.introToggleIconExpanded,
              ]}
            />
          </Pressable>
        </View>
      </View>
      {/* 游戏页签 */}
      <View style={styles.gameTabBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.gameTabBarContent}
        >
          {games.map((item) => (
            <GameTab
              key={item.id}
              label={item.name}
              iconUrl={item.iconUrl}
              active={selectedGame === String(item.id)}
              onPress={() => handleSelectGame(String(item.id))}
            />
          ))}
        </ScrollView>
      </View>
      {/* 成员列表（白色圆角面板：筛选栏 + 卡片） */}
      <FlatList
        data={members}
        keyExtractor={memberKeyExtractor}
        renderItem={renderMember}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: 92 + insets.bottom },
        ]}
        style={styles.listScroll}
        ListHeaderComponent={
          <View style={styles.filterBar}>
            {filterDefinitions.map(({ key, label }) => {
              const hasSelection =
                (key === "gender" && selectedSex !== undefined) ||
                (key === "mode" && selectedMode !== undefined) ||
                (key === "level" && selectedLevel !== undefined) ||
                (key === "advanced" &&
                  (selectedStatus !== undefined || priceSort !== "DEFAULT"));
              const selecting = openFilter === key;
              return (
                <Pressable
                  key={key}
                  accessibilityLabel={`筛选${label}`}
                  accessibilityState={{ selected: hasSelection }}
                  style={styles.filterOption}
                  onPress={() => openFilterSheet(key)}
                >
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.filterOptionText,
                      hasSelection && styles.filterOptionTextSelected,
                      selecting && styles.filterOptionTextSelecting,
                    ]}
                  >
                    {label}
                  </Text>
                  <Image
                    source={selecting ? arrowUpRedIcon : arrowDownIcon}
                    style={styles.filterArrowIcon}
                  />
                </Pressable>
              );
            })}
          </View>
        }
        ListEmptyComponent={
          companionsQuery.isLoading ? (
            <ClubDetailMemberSkeletonList />
          ) : (
            <EmptyState message="暂无大神" style={styles.memberEmpty} />
          )
        }
      />
      {/* 筛选底部弹窗 */}
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
              <Pressable accessibilityLabel="关闭" onPress={closeFilterSheet}>
                <Text style={styles.filterClose}>×</Text>
              </Pressable>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              style={styles.filterSheetBody}
            >
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
                      setSelectedLevel(undefined);
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
                        // 模式变化后等级需重新选择
                        setSelectedLevel(undefined);
                        closeFilterSheet();
                      }}
                    />
                  ))}
                </>
              )}
              {openFilter === "level" && (
                  !selectedMode ? (
                    <Text style={styles.filterSheetHint}>
                      请先选择「模式」后再选择等级
                    </Text>
                  ) : !accessToken ? (
                    <Text style={styles.filterSheetHint}>
                      登录后可选择等级
                    </Text>
                  ) : (
                    <>
                      <FilterOption
                        label="不限"
                        selected={!selectedLevel}
                        onPress={() => {
                          setSelectedLevel(undefined);
                          closeFilterSheet();
                        }}
                      />
                      {levelsQuery.data?.map((level) => (
                        <FilterOption
                          key={level.id}
                          label={level.name}
                          selected={selectedLevel === Number(level.id)}
                          onPress={() => {
                            setSelectedLevel(Number(level.id));
                            closeFilterSheet();
                          }}
                        />
                      ))}
                    </>
                  )
              )}
              {openFilter === "advanced" && (
                <>
                  <Text style={styles.filterSectionTitle}>状态</Text>
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
                  <Text style={styles.filterSectionTitle}>价格</Text>
                  <FilterOption
                    label="默认排序"
                    selected={priceSort === "DEFAULT"}
                    onPress={() => {
                      setPriceSort("DEFAULT");
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
                  <FilterOption
                    label="从高到低"
                    selected={priceSort === "DESC"}
                    onPress={() => {
                      setPriceSort("DESC");
                      closeFilterSheet();
                    }}
                  />
                </>
              )}
            </ScrollView>
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
      {/* 底部操作栏：价目表 + 一键匹配 */}
      <View
        style={[
          styles.bottomBar,
          { paddingBottom: Math.max(insets.bottom, 8) },
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
          <Text style={styles.priceButtonText}>价目表</Text>
        </Pressable>
        <Pressable
          style={styles.matchButton}
          onPress={() => {
            if (!accessToken) {
              Toast.show("请先登录", { duration: Toast.durations.SHORT });
              return;
            }
            setQuickMatchVisible(true);
          }}
        >
          <Text style={styles.matchButtonText}>一键匹配</Text>
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

/** 游戏页签：选中为白色圆角块 + 右侧反转角标，未选中透明白字 */
function GameTab({
  label,
  iconUrl,
  active,
  onPress,
}: {
  label: string;
  iconUrl?: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      style={styles.gameTab}
      onPress={onPress}
    >
      <View
        style={[styles.gameTabContent, active && styles.gameTabContentActive]}
      >
        <View style={styles.gameTabIcon}>
          {iconUrl ? (
            <CachedImage source={{ uri: iconUrl }} style={styles.gameTabIconImage} />
          ) : (
            <View style={styles.gameTabIconFallback} />
          )}
        </View>
        <Text style={[styles.gameTabText, active && styles.gameTabTextActive]}>
          {label}
        </Text>
      </View>
      {active ? (
        <Image
          source={tabCornerIcon}
          style={styles.gameTabCorner}
          pointerEvents="none"
        />
      ) : null}
    </Pressable>
  );
}

/** 成员状态标签：游戏中（橙）/ 空闲中（绿） */
function StatusTag({ status }: { status: MemberStatus }) {
  const playing = status === "playing";
  return (
    <View
      style={[styles.statusTag, playing ? styles.statusTagPlaying : styles.statusTagIdle]}
    >
      <Image
        source={playing ? statusPlayingIcon : statusIdleIcon}
        style={styles.statusTagIcon}
      />
      <Text
        style={[
          styles.statusTagText,
          { color: playing ? COLORS.orangeText : COLORS.greenText },
        ]}
      >
        {playing ? "游戏中" : "空闲中"}
      </Text>
    </View>
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
      style={styles.filterSheetOption}
    >
      <Text
        style={[
          styles.filterSheetOptionText,
          selected && styles.filterSheetOptionTextSelected,
        ]}
      >
        {label}
      </Text>
      {selected && <Text style={styles.filterSheetCheck}>✓</Text>}
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
  gameName,
  gameIconUrl,
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
  status?: MemberStatus;
  gameName?: string;
  gameIconUrl?: string;
}) {
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
      <View style={styles.memberLeft}>
        <CachedImage
          source={image ? { uri: image } : undefined}
          contentFit="cover"
          style={styles.memberAvatar}
        />
        {voiceUrl ? (
          <View style={styles.memberVoicePill}>
            <VoicePlayButton
              tone="pill"
              duration={voiceDuration}
              onToggleVoice={onToggleVoice}
              playingUrl={voicePlaying ? voiceUrl : null}
              url={voiceUrl}
            />
          </View>
        ) : null}
      </View>
      <View style={styles.memberBody}>
        <View style={styles.memberContent}>
          <View style={styles.memberTitleRow}>
            <View style={styles.memberNameGroup}>
              <Text numberOfLines={1} style={styles.memberName}>
                {name}
              </Text>
              <Image
                source={gender === "male" ? maleIcon : femaleIcon}
                style={styles.memberGenderIcon}
              />
            </View>
            {status ? <StatusTag status={status} /> : null}
          </View>
          {gameName ? (
            <View style={styles.memberGameTag}>
              <View style={styles.memberGameTagIcon}>
                {gameIconUrl ? (
                  <CachedImage
                    source={{ uri: gameIconUrl }}
                    style={styles.memberGameTagIconImage}
                  />
                ) : (
                  <View style={styles.gameTabIconFallback} />
                )}
              </View>
              <Text numberOfLines={1} style={styles.memberGameTagText}>
                {gameName}
              </Text>
            </View>
          ) : null}
          <View style={styles.memberSubtitleRow}>
            <Text numberOfLines={1} style={styles.memberSubtitle}>
              {description || "暂无个人简介"}
            </Text>
          </View>
        </View>
        <View style={styles.memberPriceRow}>
          <View style={styles.memberPrice}>
            <Text style={styles.memberPriceText}>{price}</Text>
            <Image source={diamondIcon} style={styles.memberDiamondIcon} />
          </View>
          <View style={styles.memberSales}>
            <Text style={styles.memberSalesLabel}>销量</Text>
            <Text style={styles.memberSalesValue}>{orderCount}</Text>
          </View>
        </View>
      </View>
      <View style={styles.memberDivider} pointerEvents="none" />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.white },
  background: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    width: "100%",
  },
  // 导航栏（叠加在背景图上）
  nav: {
    height: 44,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 12,
  },
  navActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  // 俱乐部信息区
  infoSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 12,
  },
  infoMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  clubLogo: {
    width: 56,
    height: 56,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: COLORS.white60,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  clubCopy: {
    flex: 1,
    minWidth: 0,
    gap: 8,
  },
  clubTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  clubName: {
    flexShrink: 1,
    color: COLORS.white,
    fontFamily: SYSTEM_FONT,
    fontSize: 20,
    fontWeight: "600",
    lineHeight: 28,
  },
  selfTag: {
    height: 16,
    paddingHorizontal: 4,
    textAlignVertical: "center",
    color: COLORS.white,
    fontFamily: SYSTEM_FONT,
    fontSize: 10,
    fontWeight: "600",
    lineHeight: 13,
    backgroundColor: COLORS.brandLight,
    borderRadius: 3,
  },
  clubMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  clubMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  clubMetaLabel: {
    color: COLORS.white60,
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "400",
  },
  clubMetaValue: {
    color: COLORS.white,
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "400",
  },
  introBlock: {
    position: "relative",
    paddingRight: 30,
  },
  introText: {
    color: COLORS.white60,
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    lineHeight: 20,
    fontWeight: "400",
  },
  introToggle: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 20,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 4,
  },
  introToggleIcon: {
    width: 20,
    height: 16,
  },
  introToggleIconExpanded: {
    transform: [{ rotate: "180deg" }],
  },
  // 游戏页签
  gameTabBar: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  gameTabBarContent: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  gameTab: {
    alignItems: "flex-end",
  },
  gameTabContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  gameTabContentActive: {
    backgroundColor: COLORS.white,
  },
  gameTabIcon: {
    width: 16,
    height: 16,
    borderRadius: 3,
    overflow: "hidden",
  },
  gameTabIconImage: {
    width: 16,
    height: 16,
    borderRadius: 3,
  },
  gameTabIconFallback: {
    width: 16,
    height: 16,
    borderRadius: 3,
    backgroundColor: "rgba(255, 255, 255, 0.25)",
  },
  gameTabText: {
    flexShrink: 0,
    color: COLORS.white,
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "400",
  },
  gameTabTextActive: {
    color: COLORS.textTitle,
    fontWeight: "500",
  },
  gameTabCorner: {
    position: "absolute",
    right: -12,
    bottom: 0,
    width: 12,
    height: 12,
  },
  // 成员列表面板
  listScroll: { flex: 1 },
  listContent: {
    backgroundColor: COLORS.white,
    borderTopRightRadius: 12,
    paddingTop: 6,
    minHeight: "100%",
  },
  // 筛选栏（三态：默认 / 选择中红色 / 已选深色）
  filterBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  filterOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: 0,
  },
  filterOptionText: {
    flexShrink: 1,
    color: COLORS.textSecondary,
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "400",
  },
  filterOptionTextSelected: {
    color: COLORS.textDark,
    fontWeight: "500",
  },
  filterOptionTextSelecting: {
    color: COLORS.brand,
    fontWeight: "500",
  },
  filterArrowIcon: {
    width: 12,
    height: 12,
  },
  // 筛选底部弹窗
  filterBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,.35)",
  },
  filterSheet: {
    maxHeight: "65%",
    paddingBottom: 28,
    backgroundColor: COLORS.white,
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
    borderBottomColor: COLORS.border,
  },
  filterSheetTitle: {
    color: COLORS.textDark,
    fontFamily: SYSTEM_FONT,
    fontSize: 16,
    fontWeight: "600",
  },
  filterClose: {
    width: 32,
    color: COLORS.textSecondary,
    fontSize: 26,
    lineHeight: 32,
    textAlign: "center",
  },
  filterSheetBody: {
    flexGrow: 0,
  },
  filterSheetHint: {
    paddingVertical: 24,
    textAlign: "center",
    color: COLORS.textTertiary,
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
  },
  filterSectionTitle: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 6,
    color: COLORS.textTertiary,
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    lineHeight: 18,
  },
  filterSheetOption: {
    height: 48,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  filterSheetOptionText: {
    color: "#333",
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
  },
  filterSheetOptionTextSelected: {
    color: COLORS.brand,
    fontWeight: "600",
  },
  filterSheetCheck: {
    color: COLORS.brand,
    fontSize: 17,
    fontWeight: "700",
  },
  memberEmpty: { alignSelf: "center", marginTop: 24 },
  // 陪玩介绍卡片（设计稿 696:122217）
  memberCard: {
    minHeight: 132,
    flexDirection: "row",
    gap: 12,
    padding: 16,
    backgroundColor: COLORS.white,
  },
  memberLeft: {
    width: 100,
    height: 100,
  },
  memberAvatar: {
    width: 100,
    height: 100,
    borderRadius: 8,
    backgroundColor: "#F5F6F7",
  },
  memberVoicePill: {
    position: "absolute",
    left: 6,
    bottom: 7,
    zIndex: 1,
  },
  memberBody: {
    flex: 1,
    minWidth: 0,
    justifyContent: "space-between",
  },
  memberContent: {
    gap: 6,
  },
  memberTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 24,
  },
  memberNameGroup: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  memberName: {
    flexShrink: 1,
    color: COLORS.textDark,
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 22,
  },
  memberGenderIcon: {
    width: 12,
    height: 12,
  },
  statusTag: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 3,
    borderRadius: 3,
  },
  statusTagPlaying: {
    backgroundColor: COLORS.orangeBg,
  },
  statusTagIdle: {
    backgroundColor: COLORS.greenBg,
  },
  statusTagIcon: {
    width: 10,
    height: 10,
  },
  statusTagText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "500",
  },
  memberGameTag: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingRight: 4,
    backgroundColor: COLORS.orangeBg,
    borderRadius: 3,
  },
  memberGameTagIcon: {
    width: 16,
    height: 16,
    borderRadius: 3,
    overflow: "hidden",
  },
  memberGameTagIconImage: {
    width: 16,
    height: 16,
    borderRadius: 3,
  },
  memberGameTagText: {
    flexShrink: 1,
    color: COLORS.gameTagText,
    fontFamily: SYSTEM_FONT,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "500",
  },
  memberSubtitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  memberSubtitle: {
    flexShrink: 1,
    color: COLORS.textTertiary,
    fontFamily: SYSTEM_FONT,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "400",
  },
  memberPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  memberPrice: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
  },
  memberPriceText: {
    color: COLORS.brand,
    fontFamily: SYSTEM_FONT,
    fontSize: 20,
    fontWeight: "600",
    lineHeight: 24,
  },
  memberDiamondIcon: {
    width: 15,
    height: 15,
    marginBottom: 3,
  },
  memberSales: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  memberSalesLabel: {
    color: COLORS.textTertiary,
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "400",
  },
  memberSalesValue: {
    color: COLORS.textQuaternary,
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "400",
  },
  memberDivider: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.border,
  },
  // 暂无价目表弹窗
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
    backgroundColor: COLORS.white,
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
    fontFamily: SYSTEM_FONT,
    fontSize: 18,
    lineHeight: 26,
    fontWeight: "600",
  },
  priceEmptyHint: {
    marginTop: 6,
    color: "#8b929e",
    fontFamily: SYSTEM_FONT,
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
    backgroundColor: COLORS.brand,
  },
  priceEmptyButtonPressed: { opacity: 0.82 },
  priceEmptyButtonText: {
    color: COLORS.white,
    fontFamily: SYSTEM_FONT,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
  },
  // 底部操作栏（次按钮 104 宽 + 主按钮撑满）
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 8,
    paddingHorizontal: 16,
    backgroundColor: COLORS.white,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  priceButton: {
    width: 104,
    height: 42,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.white,
  },
  priceButtonText: {
    color: COLORS.textDark,
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 22,
  },
  matchButton: {
    flex: 1,
    height: 42,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.brand,
  },
  matchButtonText: {
    color: COLORS.white,
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 22,
  },
});
