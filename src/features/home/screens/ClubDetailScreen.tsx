import {
  ClubDetailMemberSkeletonList,
  ClubDetailSkeleton,
} from "@/features/home/components/ClubDetailSkeleton";
import { fetchClubGameLevels } from "@/features/match/api/match.api";
import { ClubQuickMatchSheet } from "@/features/match/components/ClubQuickMatchSheet";
import { tryRestoreActiveMatch } from "@/features/match/hooks/use-quick-match-session";
import { useCustomerServiceEntry } from "@/features/mine/hooks/use-customer-service-entry";
import { useCustomerDispatch } from "@/features/voice-room/use-customer-dispatch";
import { useVoicePlayer } from "@/shared/audio/use-voice-player";
import { SYSTEM_FONT } from "@/shared/theme/typography";
import { showToast } from "@/shared/ui/app-toast";
import { EmptyState, ErrorState } from "@/shared/ui/AsyncStates";
import { PaginationFooter } from "@/shared/ui/PaginationFooter";
import { CachedImage } from "@/shared/ui/CachedImage";
import { CompanionCard } from "@/shared/ui/CompanionCard";
import { useAuthStore } from "@esports/auth";
import {
  ChevronLeft24Regular,
  Search24Regular,
} from "@fluentui/react-native-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useIsFocused, useLocalSearchParams } from "expo-router";
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
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fetchCompanionTags } from "../api/home.api";
import type { Companion, CompanionFilters, GameKey } from "../api/home.types";
import {
  useClubCompanions,
  useClubDetail,
  useClubGameModes,
  usePriceList,
} from "../hooks/use-home-data";

// 切图资源（新设计稿：俱乐部主页 455-68151 / 490-84520 / 557-88105）
const bgClubImage = require("../../../../assets/home/bg-club.webp");
// 设计稿导航栏内容行高度 44（不含状态栏，状态栏高度由安全区 insets 提供）
const NAV_BAR_CONTENT_HEIGHT = 44;
const tabCornerLeftIcon = require("../../../../assets/svgs/tab-corner-left.svg");
const tabCornerRightIcon = require("../../../../assets/svgs/tab-corner.svg");
const filterListIcon = require("../../../../assets/svgs/icon-filter-list.svg");
const filterListDefaultIcon = require("../../../../assets/svgs/icon-filter-list-default.svg");
const filterExpandArrowIcon = require("../../../../assets/svgs/filter-expand-arrow.svg");
const sheetCloseIcon = require("../../../../assets/svgs/icon-close.svg");
const introToggleIcon = require("../../../../assets/svgs/intro-toggle.svg");
const emptyStateIllustration = require("../../../../assets/svgs/empty-state-illustration.svg");
const customerIcon = require("../../../../assets/svgs/customer.svg");

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
  // 筛选栏/筛选弹窗新样式色板（设计稿 98-62854 / 581-63648）
  gold: "#FCD769",
  chipBg: "#F0F1F2",
  pillBg: "#F7F7F7",
  pillSelectedBg: "#FFF5F5",
  redAccent: "#FE1F4C",
  railBg: "#F5F6F7",
  borderLight: "#EBEBEB",
} as const;

/** 聚合筛选面板左侧分类栏（顺序对齐设计稿 581-63648） */
const FILTER_RAIL_SECTIONS = [
  { key: "gender", label: "性别" },
  { key: "status", label: "状态" },
  { key: "price", label: "价格" },
  { key: "mode", label: "模式" },
  { key: "level", label: "等级" },
  { key: "tag", label: "标签" },
] as const;

/** 确定按钮品牌渐变（设计稿 155deg，用 start/end 点近似） */
const FILTER_CONFIRM_GRADIENT = ["#FE1F4C", "#FF1F69"] as const;
const FILTER_CONFIRM_GRADIENT_START = { x: 0, y: 0 } as const;
const FILTER_CONFIRM_GRADIENT_END = { x: 0.42, y: 0.91 } as const;

/** pill 选项折叠阈值：超过 2 行（每行 3 个）时默认收起，点「展开收起」展开 */
const FILTER_PILL_COLLAPSED_COUNT = 6;

/** 折叠分区里已选项落在折叠范围（第 7 项及以后）时需要自动展开 */
function needsExpandForSelection(options: FilterPillOption[]): boolean {
  if (options.length <= FILTER_PILL_COLLAPSED_COUNT) {
    return false;
  }
  return options
    .slice(FILTER_PILL_COLLAPSED_COUNT)
    .some((option) => option.selected);
}

const memberKeyExtractor = (member: Companion) => String(member.profileId);

type ClubMemberRowProps = {
  item: Companion;
  clubId: string;
  fromClubUserId?: string;
  fromSearchPage: boolean;
  gameName?: string;
  gameIconUrl?: string;
  voicePlayingUrl: string | null;
  onToggleVoice: (url: string) => void;
};

const ClubMemberRow = memo(function ClubMemberRow({
  item,
  clubId,
  fromClubUserId,
  fromSearchPage,
  gameName,
  gameIconUrl,
  voicePlayingUrl,
  onToggleVoice,
}: ClubMemberRowProps) {
  const onPress = useCallback(() => {
    if (fromClubUserId && fromClubUserId === String(item.userId)) {
      router.back();
      return;
    }
    router.push({
      pathname: "/profile",
      params: {
        clubId,
        userId: String(item.userId),
        fromClubId: clubId,
        ...(fromSearchPage ? { fromSearch: "1" } : {}),
      },
    });
  }, [clubId, fromClubUserId, fromSearchPage, item.userId]);

  return (
    <CompanionCard
      nickname={item.nickname}
      avatar={item.headImage ?? ""}
      sex={item.sex ?? 0}
      age={item.age ?? null}
      introTagText={item.tagName}
      introTagColor={item.tagBackgroundColor || "#474748"}
      gameName={item.gameName || gameName}
      gameIconUrl={gameIconUrl}
      modeName={item.modeName}
      levelName={item.levelName}
      serviceName={item.serviceName}
      signature={item.signature}
      onlineStatus={item.onlineStatus}
      gameStatus={item.gameStatus}
      price={item.price}
      orderCount={item.orderCount}
      voiceUrl={item.voiceUrl ?? null}
      voiceDurationSeconds={item.voiceDurationSeconds ?? null}
      voicePlayingUrl={voicePlayingUrl === item.voiceUrl ? voicePlayingUrl : null}
      onToggleVoice={onToggleVoice}
      onPress={onPress}
    />
  );
}, (previous, next) =>
  previous.item === next.item &&
  previous.clubId === next.clubId &&
  previous.fromClubUserId === next.fromClubUserId &&
  previous.fromSearchPage === next.fromSearchPage &&
  previous.gameName === next.gameName &&
  previous.gameIconUrl === next.gameIconUrl &&
  previous.onToggleVoice === next.onToggleVoice &&
  (previous.voicePlayingUrl === previous.item.voiceUrl) ===
    (next.voicePlayingUrl === next.item.voiceUrl));

export default function ClubDetailScreen() {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { id, fromUserId, fromSearch } = useLocalSearchParams<{
    id?: string;
    fromUserId?: string | string[];
    fromSearch?: string | string[];
  }>();
  const fromClubUserId =
    typeof fromUserId === "string" && fromUserId.trim()
      ? fromUserId
      : undefined;
  const fromSearchPage = fromSearch === "1";
  const [game, setGame] = useState<GameKey>("");
  // 简介展开状态：默认收起两行，点击右下角按钮切换
  const [introExpanded, setIntroExpanded] = useState(false);
  // 简介真实行数（由隐藏测量层回报）：不超过两行时不展示展开/收起按钮
  const [introLineCount, setIntroLineCount] = useState(0);
  // 聚合筛选面板：左侧分类栏高亮项 + 各分区 y 坐标（点击左栏滚动定位）+ 模式/等级/标签折叠状态
  const [activeFilterSection, setActiveFilterSection] =
    useState<string>("gender");
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({});
  const filterSectionLayouts = useRef<Record<string, number>>({});
  const filterSectionsScrollRef = useRef<ScrollView | null>(null);
  const [isFilterSheetVisible, setFilterSheetVisible] = useState(false);
  const [showPriceEmptyModal, setShowPriceEmptyModal] = useState(false);
  const [quickMatchVisible, setQuickMatchVisible] = useState(false);
  const accessToken = useAuthStore((state) => state.accessToken);
  const queryClient = useQueryClient();
  const checkingActiveRef = useRef(false);
  const { openCustomerService } = useCustomerServiceEntry();
  // 俱乐部「接待派单」流程（创建/切换语聊房并自动呼叫接待）
  const { dispatch: dispatchReception } = useCustomerDispatch();

  /** 有进行中派单则恢复匹配中页；返回 true 表示已跳转 */
  const restoreActiveOrContinue = useCallback(async (): Promise<boolean> => {
    if (!accessToken) {
      showToast("请先登录");
      return true;
    }
    if (checkingActiveRef.current) return true;
    checkingActiveRef.current = true;
    try {
      return await tryRestoreActiveMatch(accessToken, queryClient);
    } finally {
      checkingActiveRef.current = false;
    }
  }, [accessToken, queryClient]);

  const [priceSort, setPriceSort] =
    useState<CompanionFilters["priceSort"]>("DEFAULT");
  const [selectedSex, setSelectedSex] = useState<CompanionFilters["sex"]>();
  const [selectedStatus, setSelectedStatus] =
    useState<CompanionFilters["gameStatus"]>();
  const [selectedMode, setSelectedMode] = useState<number>();
  const [selectedLevel, setSelectedLevel] = useState<number>();
  const [selectedTag, setSelectedTag] = useState<number>();
  const clubQuery = useClubDetail(id);
  const club = clubQuery.data;

  const handleReceptionPress = useCallback(async () => {
    const restored = await restoreActiveOrContinue();
    if (restored) return;
    void dispatchReception({ clubId: club?.id });
  }, [club?.id, dispatchReception, restoreActiveOrContinue]);

  const handleQuickMatchPress = useCallback(async () => {
    const restored = await restoreActiveOrContinue();
    if (restored) return;
    setQuickMatchVisible(true);
  }, [restoreActiveOrContinue]);
  const tagsQuery = useQuery({
    queryKey: ["companion-tags", club?.id],
    queryFn: ({ signal }) => fetchCompanionTags(club!.id, signal),
    enabled: Boolean(club?.id),
  });
  // 预拉价目表配置：页面被删除/停用时接口降级为空列表，点击价目表时直接弹"暂无价目表"而不是进报错页
  const priceConfigQuery = usePriceList(club?.pageConfigGroupId);
  const games = club?.games ?? [];
  const selectedGame = game || String(games[0]?.id ?? "");
  const selectedGameInfo = games.find(
    (item) => String(item.id) === selectedGame,
  );
  const modesQuery = useClubGameModes(selectedGame, club?.id);
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
            // 空闲中/游戏中都必须在线：离线用户的 gameStatus 不可信（可能残留为 1），
            // 只传 gameStatus 会把离线数据混进状态筛选；离线用户仅在状态不限时展示。
            onlineOnly: selectedStatus !== undefined ? true : undefined,
            gameModeId: selectedMode,
            gameLevelId: selectedLevel,
            tagId: selectedTag,
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
      selectedTag,
    ],
  );
  const companionsQuery = useClubCompanions(companionFilters);
  const members = useMemo(
    () => companionsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [companionsQuery.data],
  );
  const voicePlayer = useVoicePlayer();
  const focused = useIsFocused();
  const stopVoice = voicePlayer.stop;
  // 从详情页 push 进入成员主页/下单等页面时本页不卸载，需失焦主动停语音，
  // 避免与新页面的语音播放器叠音。口径同 GodListScreen/ProfileScreen。
  useEffect(() => {
    if (!focused) {
      stopVoice();
    }
  }, [focused, stopVoice]);
  const clubId = club?.id ?? "";
  const quickMatchClub = useMemo(
    () => (club ? { id: club.id, name: club.name } : { id: "", name: "" }),
    [club],
  );
  // 筛选底部弹窗（原始实现：蒙层渐隐 + 白色面板上滑）
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
    // iOS 下 Modal 关闭后子树仍挂载，重开面板时需把右侧选项区滚回顶部
    // （Android 因 Modal 卸载子树自动复位，scrollTo 空滚无害）
    requestAnimationFrame(() => {
      filterSectionsScrollRef.current?.scrollTo({ y: 0, animated: false });
    });
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

  const renderMember = useCallback(
    ({ item }: { item: Companion }) => (
      <ClubMemberRow
        item={item}
        clubId={clubId}
        fromClubUserId={fromClubUserId}
        fromSearchPage={fromSearchPage}
        gameName={selectedGameInfo?.name}
        gameIconUrl={selectedGameInfo?.iconUrl}
        voicePlayingUrl={voicePlayer.playingUrl}
        onToggleVoice={voicePlayer.toggle}
      />
    ),
    [
      clubId,
      fromClubUserId,
      fromSearchPage,
      selectedGameInfo?.iconUrl,
      selectedGameInfo?.name,
      voicePlayer.playingUrl,
      voicePlayer.toggle,
    ],
  );
  const loadMoreMembers = useCallback(() => {
    if (companionsQuery.hasNextPage && !companionsQuery.isFetching) {
      companionsQuery.fetchNextPage();
    }
  }, [companionsQuery]);
  function openFilterSheet() {
    if (isFilterSheetVisible) {
      return;
    }
    isFilterSheetClosing.current = false;
    setActiveFilterSection(FILTER_RAIL_SECTIONS[0].key);
    // 折叠分区里已选项超出折叠范围时自动展开，否则选中项被藏起来没有任何提示
    setExpandedSections({
      mode: needsExpandForSelection(modeOptions),
      level: needsExpandForSelection(levelOptions),
      tag: needsExpandForSelection(tagOptions),
    });
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
        // 关闭动画被打断（如窗口尺寸变化触发打开 useEffect 停掉动画）时复位标记，
        // 否则 isFilterSheetClosing 永远为 true，面板关不掉
        isFilterSheetClosing.current = false;
        return;
      }
      setFilterSheetVisible(false);
      isFilterSheetClosing.current = false;
    });
  }

  function handleResetFilters() {
    setPriceSort("DEFAULT");
    setSelectedSex(undefined);
    setSelectedStatus(undefined);
    setSelectedMode(undefined);
    setSelectedLevel(undefined);
    setSelectedTag(undefined);
  }

  function handleSelectGame(nextGameId: string) {
    setGame(nextGameId);
    // 切换游戏后模式/等级需要重新选择
    setSelectedMode(undefined);
    setSelectedLevel(undefined);
  }
  // 是否存在生效中的筛选项：筛选按钮据此显示红色/深色（与面板是否展开无关）
  const hasActiveFilters =
    priceSort !== "DEFAULT" ||
    selectedSex !== undefined ||
    selectedStatus !== undefined ||
    selectedMode !== undefined ||
    selectedLevel !== undefined ||
    selectedTag !== undefined;
  // 聚合筛选面板各分区选项（选中立即生效，列表在面板背后实时重查；选项量小，不做 memo）
  const modeOptions: FilterPillOption[] = [
    {
      key: "all",
      label: "不限",
      selected: selectedMode === undefined,
      onPress: () => {
        setSelectedMode(undefined);
        setSelectedLevel(undefined);
      },
    },
    ...(modesQuery.data ?? []).map((mode) => ({
      key: String(mode.id),
      label: mode.modeName,
      selected: selectedMode === mode.id,
      onPress: () => {
        setSelectedMode(mode.id);
        // 模式变化后等级需重新选择
        setSelectedLevel(undefined);
      },
    })),
  ];
  const levelOptions: FilterPillOption[] =
    !selectedMode || !accessToken
      ? []
      : [
          {
            key: "all",
            label: "不限",
            selected: selectedLevel === undefined,
            onPress: () => setSelectedLevel(undefined),
          },
          ...(levelsQuery.data ?? []).map((level) => ({
            key: String(level.id),
            label: level.name,
            selected: selectedLevel === Number(level.id),
            onPress: () => setSelectedLevel(Number(level.id)),
          })),
        ];
  const tagOptions: FilterPillOption[] = [
    {
      key: "all",
      label: "不限",
      selected: selectedTag === undefined,
      onPress: () => setSelectedTag(undefined),
    },
    ...(tagsQuery.data ?? []).map((tag) => ({
      key: String(tag.id),
      label: tag.name,
      selected: selectedTag === tag.id,
      onPress: () => setSelectedTag(tag.id),
    })),
  ];

  if (clubQuery.isLoading) {
    return (
      <ClubDetailSkeleton topInset={insets.top} bottomInset={insets.bottom} />
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
      <View
        style={[
          styles.nav,
          {
            paddingTop: insets.top,
            height: insets.top + NAV_BAR_CONTENT_HEIGHT,
          },
        ]}
      >
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
            style={styles.navActionButton}
            onPress={() => {
              // 搜索页已在栈内时弹回它，避免 搜索/俱乐部/个人主页 反复跳转无限套娃
              if (fromSearchPage) {
                router.dismissTo({
                  pathname: "/search",
                  params: { type: "user", clubId: club.id },
                });
                return;
              }
              router.push({
                pathname: "/search",
                params: { type: "user", clubId: club.id },
              });
            }}
          >
            <Search24Regular color={COLORS.white} width={24} height={24} />
          </Pressable>
          <Pressable
            accessibilityLabel="在线客服"
            hitSlop={10}
            style={[styles.navActionButton, styles.navActionCustomer]}
            onPress={openCustomerService}
          >
            <Image source={customerIcon} style={{ width: 24, height: 24 }} />
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
              {club.clubTag ? (
                <View style={styles.clubTag}>
                  <Text numberOfLines={1} style={styles.clubTagText}>
                    {club.clubTag}
                  </Text>
                </View>
              ) : null}
            </View>
            <View style={styles.clubMetaRow}>
              <View style={styles.clubMetaItem}>
                <Text style={styles.clubMetaLabel}>成员</Text>
                <Text style={styles.clubMetaValue}>{club.memberCount}人</Text>
              </View>
              <View style={styles.clubMetaItem}>
                <Text style={styles.clubMetaLabel}>俱乐部ID</Text>
                <Text style={styles.clubMetaValue}>{club.clubCode ?? club.id}</Text>
              </View>
            </View>
          </View>
        </View>
        <View style={styles.introBlock}>
          {/* 隐藏测量层：不限制行数，取真实行数判断是否展示展开按钮 */}
          <Text
            numberOfLines={undefined}
            onTextLayout={(event) => {
              const count = event.nativeEvent.lines.length;
              if (count !== introLineCount) {
                setIntroLineCount(count);
              }
            }}
            style={[styles.introText, styles.introTextMeasure]}
          >
            {club.intro}
          </Text>
          <Text
            numberOfLines={introExpanded ? undefined : 2}
            style={styles.introText}
          >
            {club.intro}
          </Text>
          {introLineCount > 2 ? (
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
          ) : null}
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
      {/* 成员列表面板（白色圆角容器：固定筛选栏 + 卡片列表，筛选栏不随列表滚动） */}
      <View style={styles.listWrap}>
        <View style={styles.filterBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterTagScroll}
            contentContainerStyle={styles.filterTagRow}
          >
            {tagsQuery.data?.map((tag) => {
              const selected = selectedTag === tag.id;
              return (
                <Pressable
                  key={tag.id}
                  accessibilityRole="button"
                  accessibilityLabel={tag.name}
                  accessibilityState={{ selected }}
                  style={[
                    styles.filterTagChip,
                    selected && styles.filterTagChipSelected,
                  ]}
                  onPress={() => setSelectedTag(selected ? undefined : tag.id)}
                >
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.filterTagText,
                      selected && styles.filterTagTextSelected,
                    ]}
                  >
                    {tag.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="展开筛选"
            hitSlop={6}
            style={styles.filterExpandButton}
            onPress={openFilterSheet}
          >
            <Image
              accessibilityIgnoresInvertColors
              source={hasActiveFilters ? filterListIcon : filterListDefaultIcon}
              style={styles.filterExpandIcon}
            />
          </Pressable>
        </View>
        <FlatList
          data={members}
          keyExtractor={memberKeyExtractor}
          renderItem={renderMember}
          onEndReached={loadMoreMembers}
          onEndReachedThreshold={0.4}
          ItemSeparatorComponent={MemberCardSeparator}
          initialNumToRender={5}
          maxToRenderPerBatch={5}
          windowSize={5}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: 92 + insets.bottom },
          ]}
          style={styles.listScroll}
          ListEmptyComponent={
            companionsQuery.isLoading ? (
              <ClubDetailMemberSkeletonList />
            ) : (
              <EmptyState message="暂无大神" style={styles.memberEmpty} />
            )
          }
          ListFooterComponent={
            members.length > 0 ? (
              <PaginationFooter
                loading={companionsQuery.isFetchingNextPage}
                hasMore={companionsQuery.hasNextPage}
                pageCount={companionsQuery.data?.pages.length}
              />
            ) : null
          }
        />
      </View>
      {/* 筛选底部弹窗（聚合面板：左分类栏 + 右选项区 + 重置/确定） */}
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
              // 兼容手势/三键导航条机型：底部预留安全区，避免最后一项被系统导航栏遮挡
              { paddingBottom: Math.max(insets.bottom, 28) },
              { transform: [{ translateY: filterSheetTranslateY }] },
            ]}
          >
            <View style={styles.filterSheetHeader}>
              <Text style={styles.filterSheetTitle}>筛选</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="关闭"
                hitSlop={8}
                style={styles.filterSheetClose}
                onPress={closeFilterSheet}
              >
                <Image
                  accessibilityIgnoresInvertColors
                  source={sheetCloseIcon}
                  style={styles.filterSheetCloseIcon}
                />
              </Pressable>
            </View>
            <View style={styles.filterSheetBody}>
              <View style={styles.filterRail}>
                {FILTER_RAIL_SECTIONS.map(({ key, label }) => {
                  const active = activeFilterSection === key;
                  return (
                    <Pressable
                      key={key}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: active }}
                      style={[
                        styles.filterRailItem,
                        active && styles.filterRailItemActive,
                      ]}
                      onPress={() => {
                        setActiveFilterSection(key);
                        const y = filterSectionLayouts.current[key];
                        if (y !== undefined) {
                          filterSectionsScrollRef.current?.scrollTo({
                            y: Math.max(y - 8, 0),
                            animated: true,
                          });
                        }
                      }}
                    >
                      <Text
                        style={[
                          styles.filterRailText,
                          active && styles.filterRailTextActive,
                        ]}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <ScrollView
                ref={filterSectionsScrollRef}
                showsVerticalScrollIndicator={false}
                style={styles.filterSheetSections}
                contentContainerStyle={styles.filterSheetSectionsContent}
                scrollEventThrottle={16}
                onScroll={(event) => {
                  // 滚动时同步左侧分类栏高亮：取最后一个起始位置越过当前视口顶部的分区
                  const { contentOffset, contentSize, layoutMeasurement } =
                    event.nativeEvent;
                  // 滚到底部时强制高亮最后一个分区：短内容下最大偏移量够不到「标签」的 y，否则永远高亮不到
                  const isAtBottom =
                    contentSize.height - layoutMeasurement.height - contentOffset.y < 24;
                  let current: string =
                    FILTER_RAIL_SECTIONS[FILTER_RAIL_SECTIONS.length - 1].key;
                  if (!isAtBottom) {
                    current = FILTER_RAIL_SECTIONS[0].key;
                    for (const { key } of FILTER_RAIL_SECTIONS) {
                      const y = filterSectionLayouts.current[key];
                      if (y !== undefined && y <= contentOffset.y + 24) {
                        current = key;
                      }
                    }
                  }
                  setActiveFilterSection(current);
                }}
              >
                <View
                  style={styles.filterSection}
                  onLayout={(event) => {
                    filterSectionLayouts.current.gender =
                      event.nativeEvent.layout.y;
                  }}
                >
                  <Text style={styles.filterSectionTitle}>性别</Text>
                  <FilterPillRow
                    options={[
                      {
                        key: "all",
                        label: "不限",
                        selected: selectedSex === undefined,
                        onPress: () => setSelectedSex(undefined),
                      },
                      {
                        key: "male",
                        label: "男",
                        selected: selectedSex === 1,
                        onPress: () => setSelectedSex(1),
                      },
                      {
                        key: "female",
                        label: "女",
                        selected: selectedSex === 2,
                        onPress: () => setSelectedSex(2),
                      },
                    ]}
                  />
                </View>
                <View
                  style={styles.filterSection}
                  onLayout={(event) => {
                    filterSectionLayouts.current.status =
                      event.nativeEvent.layout.y;
                  }}
                >
                  <Text style={styles.filterSectionTitle}>状态</Text>
                  <FilterPillRow
                    options={[
                      {
                        key: "all",
                        label: "不限",
                        selected: selectedStatus === undefined,
                        onPress: () => setSelectedStatus(undefined),
                      },
                      {
                        key: "idle",
                        label: "空闲中",
                        selected: selectedStatus === 0,
                        onPress: () => setSelectedStatus(0),
                      },
                      {
                        key: "playing",
                        label: "游戏中",
                        selected: selectedStatus === 1,
                        onPress: () => setSelectedStatus(1),
                      },
                    ]}
                  />
                </View>
                <View
                  style={styles.filterSection}
                  onLayout={(event) => {
                    filterSectionLayouts.current.price =
                      event.nativeEvent.layout.y;
                  }}
                >
                  <Text style={styles.filterSectionTitle}>价格</Text>
                  <FilterPillRow
                    options={[
                      {
                        key: "default",
                        label: "默认排序",
                        selected: priceSort === "DEFAULT",
                        onPress: () => setPriceSort("DEFAULT"),
                      },
                      {
                        key: "asc",
                        label: "从低到高",
                        selected: priceSort === "ASC",
                        onPress: () => setPriceSort("ASC"),
                      },
                      {
                        key: "desc",
                        label: "从高到低",
                        selected: priceSort === "DESC",
                        onPress: () => setPriceSort("DESC"),
                      },
                    ]}
                  />
                </View>
                <View
                  style={styles.filterSection}
                  onLayout={(event) => {
                    filterSectionLayouts.current.mode =
                      event.nativeEvent.layout.y;
                  }}
                >
                  <Text style={styles.filterSectionTitle}>模式</Text>
                  <FilterPillRow
                    options={modeOptions}
                    collapsed={
                      modeOptions.length > FILTER_PILL_COLLAPSED_COUNT &&
                      !expandedSections.mode
                    }
                  />
                  {modeOptions.length > FILTER_PILL_COLLAPSED_COUNT ? (
                    <FilterExpandToggle
                      expanded={Boolean(expandedSections.mode)}
                      onToggle={() => {
                        setExpandedSections((previous) => ({
                          ...previous,
                          mode: !previous.mode,
                        }));
                      }}
                    />
                  ) : null}
                </View>
                <View
                  style={styles.filterSection}
                  onLayout={(event) => {
                    filterSectionLayouts.current.level =
                      event.nativeEvent.layout.y;
                  }}
                >
                  <Text style={styles.filterSectionTitle}>等级</Text>
                  {!selectedMode ? (
                    <Text style={styles.filterSheetHint}>
                      请先选择「模式」后再选择等级
                    </Text>
                  ) : !accessToken ? (
                    <Text style={styles.filterSheetHint}>
                      登录后可选择等级
                    </Text>
                  ) : (
                    <>
                      <FilterPillRow
                        options={levelOptions}
                        collapsed={
                          levelOptions.length > FILTER_PILL_COLLAPSED_COUNT &&
                          !expandedSections.level
                        }
                      />
                      {levelOptions.length > FILTER_PILL_COLLAPSED_COUNT ? (
                        <FilterExpandToggle
                          expanded={Boolean(expandedSections.level)}
                          onToggle={() => {
                            setExpandedSections((previous) => ({
                              ...previous,
                              level: !previous.level,
                            }));
                          }}
                        />
                      ) : null}
                    </>
                  )}
                </View>
                <View
                  style={styles.filterSection}
                  onLayout={(event) => {
                    filterSectionLayouts.current.tag =
                      event.nativeEvent.layout.y;
                  }}
                >
                  <Text style={styles.filterSectionTitle}>标签</Text>
                  <FilterPillRow
                    options={tagOptions}
                    collapsed={
                      tagOptions.length > FILTER_PILL_COLLAPSED_COUNT &&
                      !expandedSections.tag
                    }
                  />
                  {tagOptions.length > FILTER_PILL_COLLAPSED_COUNT ? (
                    <FilterExpandToggle
                      expanded={Boolean(expandedSections.tag)}
                      onToggle={() => {
                        setExpandedSections((previous) => ({
                          ...previous,
                          tag: !previous.tag,
                        }));
                      }}
                    />
                  ) : null}
                </View>
              </ScrollView>
            </View>
            <View style={styles.filterSheetFooter}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="重置筛选"
                style={({ pressed }) => [
                  styles.filterResetButton,
                  pressed && styles.filterResetButtonPressed,
                ]}
                onPress={handleResetFilters}
              >
                <Text style={styles.filterResetButtonText}>重置</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="确定"
                style={styles.filterConfirmButton}
                onPress={closeFilterSheet}
              >
                <LinearGradient
                  colors={FILTER_CONFIRM_GRADIENT}
                  start={FILTER_CONFIRM_GRADIENT_START}
                  end={FILTER_CONFIRM_GRADIENT_END}
                  style={styles.filterConfirmGradient}
                >
                  <Text style={styles.filterConfirmButtonText}>确定</Text>
                </LinearGradient>
              </Pressable>
            </View>
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
      {/* 底部操作栏：价目表 + 接待派单 + 一键匹配 */}
      <View
        style={[
          styles.bottomBar,
          { paddingBottom: Math.max(insets.bottom, 8) },
        ]}
      >
        <Pressable
          style={styles.priceButton}
          onPress={() => {
            // 未配置价目表链接，或链接指向的页面配置已删除/停用（预拉结果为空）时，弹"暂无价目表"提示
            if (
              !club.pageConfigGroupId ||
              (priceConfigQuery.isSuccess && priceConfigQuery.data.length === 0)
            ) {
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
            void handleReceptionPress();
          }}
        >
          <Text style={styles.matchButtonText}>接待派单</Text>
        </Pressable>
        <Pressable
          style={styles.matchButton}
          onPress={() => {
            void handleQuickMatchPress();
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
            <CachedImage
              source={{ uri: iconUrl }}
              style={styles.gameTabIconImage}
            />
          ) : (
            <View style={styles.gameTabIconFallback} />
          )}
        </View>
        <Text style={[styles.gameTabText, active && styles.gameTabTextActive]}>
          {label}
        </Text>
      </View>
      {active ? (
        <>
          <Image
            source={tabCornerLeftIcon}
            style={[styles.gameTabCorner, styles.gameTabCornerLeft]}
            pointerEvents="none"
          />
          <Image
            source={tabCornerRightIcon}
            style={[styles.gameTabCorner, styles.gameTabCornerRight]}
            pointerEvents="none"
          />
        </>
      ) : null}
    </Pressable>
  );
}

type FilterPillOption = {
  key: string;
  label: string;
  selected: boolean;
  onPress: () => void;
};

/** pill 选项按每行 3 个切行（设计稿右侧选项区为 3 列等分） */
function chunkFilterOptions(options: FilterPillOption[]): FilterPillOption[][] {
  const rows: FilterPillOption[][] = [];
  for (let i = 0; i < options.length; i += 3) {
    rows.push(options.slice(i, i + 3));
  }
  return rows;
}

/** 聚合筛选面板右侧选项 pill 行：3 列等分，选中红字浅红底；collapsed 时只展示前两行 */
function FilterPillRow({
  options,
  collapsed,
}: {
  options: FilterPillOption[];
  collapsed?: boolean;
}) {
  const visibleOptions = collapsed
    ? options.slice(0, FILTER_PILL_COLLAPSED_COUNT)
    : options;
  return (
    <>
      {chunkFilterOptions(visibleOptions).map((row, rowIndex) => (
        <View key={rowIndex} style={styles.filterPillRow}>
          {row.map((option) => (
            <Pressable
              key={option.key}
              accessibilityRole="radio"
              accessibilityState={{ selected: option.selected }}
              style={[
                styles.filterPill,
                option.selected && styles.filterPillSelected,
              ]}
              onPress={option.onPress}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.filterPillText,
                  option.selected && styles.filterPillTextSelected,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ))}
    </>
  );
}

/** 模式/等级/标签选项过多时的「展开收起」按钮（箭头随展开状态旋转） */
function FilterExpandToggle({
  expanded,
  onToggle,
}: {
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={expanded ? "收起" : "展开"}
      style={styles.filterExpandToggle}
      onPress={onToggle}
    >
      <Text style={styles.filterExpandToggleText}>
        {expanded ? "收起" : "展开"}
      </Text>
      <Image
        accessibilityIgnoresInvertColors
        source={filterExpandArrowIcon}
        style={[
          styles.filterExpandToggleIcon,
          expanded && styles.filterExpandToggleIconUp,
        ]}
      />
    </Pressable>
  );
}

/** 成员卡片分割线：原卡片内绝对定位分割线改为列表分隔符 */
function MemberCardSeparator() {
  return <View style={styles.memberSeparator} />;
}

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
    // 导航行内容高度 44（设计稿），加上状态栏高度由动态 style 传入
    height: NAV_BAR_CONTENT_HEIGHT,
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
  // 右上角图标按钮占位框 32×24（图标本身仍 24×24 居中）
  navActionButton: {
    width: 32,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  // 客服图标相对搜索图标视觉下移 1pt，对齐设计稿
  navActionCustomer: {
    marginTop: 1,
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
  clubTag: {
    height: 17,
    paddingHorizontal: 4,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.brandLight,
    borderRadius: 3,
  },
  clubTagText: {
    color: COLORS.white,
    fontFamily: SYSTEM_FONT,
    fontSize: 10,
    fontWeight: "600",
    lineHeight: 13,
    includeFontPadding: false,
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
  // 隐藏测量层：绝对定位脱离布局流，不影响可见简介的排版；
  // 绝对定位不受父级 paddingRight 约束，需手动补 30 与可见文本等宽，否则行数会算少
  introTextMeasure: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 30,
    opacity: 0,
  },
  introToggle: {
    position: "absolute",
    right: 0,
    bottom: 3,
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
    position: "relative",
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
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
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
    bottom: 0,
    width: 12,
    height: 12,
  },
  gameTabCornerLeft: {
    left: -12,
  },
  gameTabCornerRight: {
    right: -12,
  },
  // 成员列表面板（白色圆角容器，筛选栏固定在面板顶部不随列表滚动）
  listWrap: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderTopRightRadius: 12,
    paddingTop: 6,
    overflow: "hidden",
  },
  listScroll: { flex: 1 },
  listContent: { minHeight: "100%" },
  // 固定筛选栏：左侧俱乐部标签 chips 横向滚动 + 右侧筛选展开按钮（设计稿 98-62854）
  filterBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 12,
  },
  filterTagScroll: { flex: 1 },
  filterTagRow: {
    alignItems: "center",
    gap: 8,
  },
  filterTagChip: {
    height: 24,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    backgroundColor: COLORS.chipBg,
  },
  filterTagChipSelected: { backgroundColor: COLORS.gold },
  filterTagText: {
    color: COLORS.textDark,
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "400",
  },
  filterTagTextSelected: { fontWeight: "500" },
  filterExpandButton: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  filterExpandIcon: { width: 20, height: 20 },
  // 筛选底部弹窗（聚合面板，设计稿 581-63648）
  filterBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,.35)",
  },
  filterSheet: {
    height: "80%",
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    overflow: "hidden",
  },
  filterSheetHeader: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  filterSheetTitle: {
    color: COLORS.textDark,
    fontFamily: SYSTEM_FONT,
    fontSize: 16,
    fontWeight: "500",
  },
  filterSheetClose: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  filterSheetCloseIcon: { width: 32, height: 32 },
  filterSheetBody: {
    flex: 1,
    flexDirection: "row",
  },
  // 左侧分类栏
  filterRail: {
    width: 80,
    backgroundColor: COLORS.railBg,
  },
  filterRailItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  filterRailItemActive: { backgroundColor: COLORS.white },
  filterRailText: {
    color: "#666666",
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "400",
  },
  filterRailTextActive: {
    color: COLORS.redAccent,
    fontWeight: "500",
  },
  // 右侧分区列表
  filterSheetSections: { flex: 1 },
  filterSheetSectionsContent: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 16,
  },
  filterSection: { gap: 8 },
  filterSectionTitle: {
    color: COLORS.textDark,
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
  },
  filterPillRow: {
    flexDirection: "row",
    gap: 8,
  },
  filterPill: {
    flex: 1,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 4,
    backgroundColor: COLORS.pillBg,
    paddingHorizontal: 4,
  },
  filterPillSelected: { backgroundColor: COLORS.pillSelectedBg },
  filterPillText: {
    color: COLORS.textDark,
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "400",
    textAlign: "center",
  },
  filterPillTextSelected: {
    color: COLORS.redAccent,
    fontWeight: "500",
  },
  filterExpandToggle: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
  },
  filterExpandToggleText: {
    color: "#999999",
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    lineHeight: 17,
  },
  filterExpandToggleIcon: { width: 16, height: 16 },
  filterExpandToggleIconUp: { transform: [{ rotate: "180deg" }] },
  filterSheetHint: {
    paddingVertical: 8,
    color: COLORS.textTertiary,
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    lineHeight: 18,
  },
  // 底部操作区：重置（白底描边）+ 确定（品牌渐变撑满）
  filterSheetFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  filterResetButton: {
    height: 42,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    backgroundColor: COLORS.white,
  },
  filterResetButtonPressed: { opacity: 0.82 },
  filterResetButtonText: {
    color: COLORS.textDark,
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 22,
  },
  filterConfirmButton: {
    flex: 1,
    height: 42,
    borderRadius: 8,
    overflow: "hidden",
  },
  filterConfirmGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  filterConfirmButtonText: {
    color: COLORS.white,
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 22,
  },
  memberEmpty: { alignSelf: "center", marginTop: 24 },
  // 成员卡片分隔符（对齐大神列表 hairline 分割线）
  memberSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.border,
    marginHorizontal: 16,
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
