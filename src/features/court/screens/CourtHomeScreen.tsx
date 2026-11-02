import { CourtCard } from "@/features/court/components/CourtCard";
import { CourtReviewerPromptModal } from "@/features/court/components/CourtReviewerPromptModal";
import { PlatformTicketCard } from "@/features/court/components/PlatformTicketCard";
import {
  applyVoteToCases,
  isCourtReviewerApproved,
  submitCourtVote,
} from "@/features/court/court-vote";
import {
  courtApi,
  pageRecords,
  type CourtCase,
  type CourtScope,
  type PlatformTicket,
} from "@/features/court/court.api";
import { COURT_FONT_FAMILY } from "@/features/court/court.theme";
import { EmptyState } from "@/shared/ui/AsyncStates";
import { CachedImage } from "@/shared/ui/CachedImage";
import { useAuthStore } from "@esports/auth";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { showToast } from "@/shared/ui/app-toast";

const FEEDS: { key: CourtScope; label: string }[] = [
  { key: "ALL", label: "全部" },
  { key: "LATEST", label: "最新" },
  { key: "FAVORITE", label: "收藏" },
  { key: "MY", label: "我的" },
];

type Props = { bottomInset: number; initialPage?: "court" | "ticket" };

export function CourtHomeScreen({ bottomInset, initialPage = "court" }: Props) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const [pageType, setPageType] = useState<"court" | "ticket">(initialPage);
  const [scope, setScope] = useState<CourtScope>("ALL");
  const [ticketMine, setTicketMine] = useState(initialPage === "ticket");
  const [cases, setCases] = useState<CourtCase[]>([]);
  const [tickets, setTickets] = useState<PlatformTicket[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isReviewer, setIsReviewer] = useState(false);
  const [reviewerStats, setReviewerStats] = useState<{
    todayCount?: number;
    totalCount?: number;
  }>({});
  const [pendingAction, setPendingAction] = useState<{
    caseId: string;
    type: "vote" | "favorite";
  } | null>(null);
  const [reviewerPromptVisible, setReviewerPromptVisible] = useState(false);
  const listRef = useRef<FlatList<CourtCase | PlatformTicket>>(null);
  const [backToTopFeed, setBackToTopFeed] = useState<string | null>(null);
  const voteInFlight = useRef(false);
  const loadRequestRef = useRef(0);
  const loadedFeedRef = useRef<string | null>(null);
  const feedKey = JSON.stringify([pageType, scope, ticketMine, accessToken]);

  const requireLogin = useCallback(() => {
    if (accessToken) return true;
    router.push("/login");
    return false;
  }, [accessToken]);

  const load = useCallback(
    async (append = false, preservePages = false) => {
      if (append && (loading || loadingMore || !hasMore)) {
        return;
      }
      const requestId = ++loadRequestRef.current;
      const next = append ? page + 1 : preservePages ? page : 1;
      const pages = append
        ? [next]
        : Array.from({ length: next }, (_, index) => index + 1);
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      try {
        if (pageType === "court") {
          const data = await Promise.all(
            pages.map((pageNumber) => courtApi.getPage(scope, pageNumber, 20)),
          );
          if (requestId !== loadRequestRef.current) {
            return;
          }
          const rows = data.flatMap(pageRecords);
          setCases((current) => (append ? current.concat(rows) : rows));
          setHasMore(
            rows.length + (append ? cases.length : 0) <
              (data[0]?.total ?? rows.length),
          );
        } else {
          const data = await Promise.all(
            pages.map((pageNumber) =>
              courtApi.getTicketPage(ticketMine, pageNumber, 20),
            ),
          );
          if (requestId !== loadRequestRef.current) {
            return;
          }
          const rows = data.flatMap(pageRecords);
          setTickets((current) => (append ? current.concat(rows) : rows));
          setHasMore(
            rows.length + (append ? tickets.length : 0) <
              (data[0]?.total ?? rows.length),
          );
        }
        setPage(next);
      } catch (error) {
        if (requestId !== loadRequestRef.current) {
          return;
        }
        if (!append && !preservePages) {
          setCases([]);
          setTickets([]);
        }
        showToast(error instanceof Error ? error.message : "加载失败");
      } finally {
        if (requestId === loadRequestRef.current) {
          setLoading(false);
          setLoadingMore(false);
          setRefreshing(false);
        }
      }
    },
    [
      cases.length,
      hasMore,
      loading,
      loadingMore,
      page,
      pageType,
      scope,
      ticketMine,
      tickets.length,
    ],
  );

  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);
  useFocusEffect(
    useCallback(() => {
      const preservePages = loadedFeedRef.current === feedKey;
      loadedFeedRef.current = feedKey;
      const timer = setTimeout(() => {
        if (!preservePages) {
          setBackToTopFeed(null);
          setCases([]);
          setTickets([]);
          setPage(1);
        }
        loadRef.current(false, preservePages);
      }, 0);
      return () => {
        clearTimeout(timer);
        loadRequestRef.current += 1;
      };
    }, [feedKey]),
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const timer = setTimeout(async () => {
        setIsReviewer(false);
        setReviewerStats({});
        setReviewerPromptVisible(false);
        if (!accessToken) {
          return;
        }
        try {
          const status = await courtApi.getReviewerStatus();
          if (!active) {
            return;
          }
          const approved = isCourtReviewerApproved(status);
          setIsReviewer(approved);
          if (approved) {
            const stats = await courtApi.getReviewerStats().catch(() => ({}));
            if (active) {
              setReviewerStats(stats);
            }
          }
        } catch {
          if (active) {
            setIsReviewer(false);
          }
        }
      }, 0);
      return () => {
        active = false;
        clearTimeout(timer);
      };
    }, [accessToken]),
  );

  const data = useMemo(
    () => (pageType === "court" ? cases : tickets),
    [cases, pageType, tickets],
  );

  async function vote(
    item: CourtCase,
    result: "PLAINTIFF_WIN" | "DEFENDANT_WIN",
  ) {
    if (!requireLogin() || pendingAction || voteInFlight.current) {
      return;
    }
    voteInFlight.current = true;
    setPendingAction({ caseId: String(item.caseId), type: "vote" });
    try {
      const outcome = await submitCourtVote(item, result);
      if (accessToken !== useAuthStore.getState().accessToken) {
        return;
      }
      setIsReviewer(isCourtReviewerApproved(outcome.reviewerStatus));
      if (outcome.type === "reviewer-required") {
        setReviewerPromptVisible(true);
        return;
      }
      setCases((current) =>
        applyVoteToCases(current, item.caseId, result, outcome.voteCounts),
      );
      showToast("支持成功");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "投票失败");
    } finally {
      voteInFlight.current = false;
      setPendingAction(null);
    }
  }

  async function toggleFavorite(item: CourtCase) {
    if (!requireLogin() || pendingAction) {
      return;
    }
    setPendingAction({ caseId: String(item.caseId), type: "favorite" });
    try {
      const result = await courtApi.favorite(item.caseId, !item.favorited);
      setCases((current) =>
        current
          .filter(
            (row) =>
              scope !== "FAVORITE" ||
              result.favorited !== false ||
              String(row.caseId) !== String(item.caseId),
          )
          .map((row) =>
            String(row.caseId) === String(item.caseId)
              ? {
                  ...row,
                  favorited: result.favorited,
                  favoriteCount: result.favoriteCount ?? row.favoriteCount,
                }
              : row,
          ),
      );
      showToast(result.favorited ? "收藏成功" : "已取消收藏");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "收藏失败");
    } finally {
      setPendingAction(null);
    }
  }

  const openTicketForm = () => {
    if (requireLogin()) router.push("/court/complaint?mode=ticket");
  };
  const openReviewForm = () => {
    if (!requireLogin()) {
      return;
    }
    router.push("/court/complaint?mode=court");
  };

  const listHeader = (
    <>
      <View style={styles.sectionTabs}>
        <Pressable
          onPress={() => setPageType("court")}
          style={styles.sectionTab}
        >
          <Text
            style={[
              styles.sectionText,
              pageType === "court" && styles.sectionSelected,
            ]}
          >
            小法庭
          </Text>
          {pageType === "court" && (
            <CachedImage
              source={require("../../../../assets/court/tab-indicator.svg")}
              style={styles.sectionUnderline}
            />
          )}
        </Pressable>
        <Pressable
          onPress={() => setPageType("ticket")}
          style={styles.sectionTab}
        >
          <Text
            style={[
              styles.sectionText,
              pageType === "ticket" && styles.sectionSelected,
            ]}
          >
            平台工单
          </Text>
          {pageType === "ticket" && (
            <CachedImage
              source={require("../../../../assets/court/tab-indicator.svg")}
              style={styles.sectionUnderline}
            />
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={pageType === "court" ? "发起评审" : "发起投诉"}
          onPress={pageType === "court" ? openReviewForm : openTicketForm}
          style={styles.reviewAction}
        >
          <CachedImage
            accessible={false}
            source={require("../../../../assets/court/edit.svg")}
            contentFit="contain"
            style={styles.reviewActionIcon}
          />
          <Text style={styles.reviewActionText}>
            {pageType === "court" ? "发起评审" : "发起投诉"}
          </Text>
        </Pressable>
      </View>
      {pageType === "court" ? (
        <>
          <View style={styles.feedRow}>
            <View style={styles.feedTabs}>
              {FEEDS.map((tab) => (
                <Pressable
                  key={tab.key}
                  onPress={() => {
                    if (
                      (tab.key === "MY" || tab.key === "FAVORITE") &&
                      !requireLogin()
                    )
                      return;
                    setScope(tab.key);
                  }}
                  style={[
                    styles.feedTab,
                    scope === tab.key && styles.feedTabSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.feedText,
                      scope === tab.key && styles.feedTextSelected,
                    ]}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          {/* {isReviewer && scope !== "MY" && (
            <View style={styles.statsRow}>
              <Text style={styles.statsLabel}>
                今日已评审
                <Text style={styles.statsValue}>
                  {reviewerStats.todayCount ?? 0}
                </Text>
              </Text>
              <Text style={styles.statsLabel}>
                累计评审
                <Text style={styles.statsValue}>
                  {reviewerStats.totalCount ?? 0}
                </Text>
              </Text>
            </View>
          )} */}
        </>
      ) : (
        <View style={styles.feedRow}>
          <View accessibilityRole="tablist" style={styles.feedTabs}>
            {[false, true].map((mine) => (
              <Pressable
                key={String(mine)}
                accessibilityRole="tab"
                accessibilityState={{ selected: ticketMine === mine }}
                onPress={() => {
                  if (mine && !requireLogin()) {
                    return;
                  }
                  setTicketMine(mine);
                }}
                style={[
                  styles.feedTab,
                  ticketMine === mine && styles.feedTabSelected,
                ]}
              >
                <Text
                  style={[
                    styles.feedText,
                    ticketMine === mine && styles.feedTextSelected,
                  ]}
                >
                  {mine ? "我的" : "全部"}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </>
  );

  const renderCase = ({ item }: { item: CourtCase }) => (
    <CourtCard
      item={item}
      onOpen={() =>
        router.push({
          pathname: "/court/[id]",
          params: { id: String(item.caseId), mine: scope === "MY" ? "1" : "0" },
        })
      }
      onVote={vote}
      onFavorite={toggleFavorite}
      pendingAction={
        pendingAction?.caseId === String(item.caseId)
          ? pendingAction.type
          : null
      }
    />
  );
  const renderTicket = ({ item }: { item: PlatformTicket }) => (
    <PlatformTicketCard
      item={item}
      mine={ticketMine}
      onOpen={() =>
        router.push(
          `/court/ticket/${item.ticketId ?? item.ticketNo}?mine=${ticketMine ? "1" : "0"}`,
        )
      }
    />
  );

  return (
    <View style={styles.panel}>
      <LinearGradient
        colors={["#FFFFFF", "#F7F7F7"]}
        locations={[0, 0.2]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <FlatList
        key={feedKey}
        ref={listRef}
        onScroll={(event) => {
          // 滚动中绝大多数事件与当前状态相同，React 对同值 setState 直接豁免，避免低端机滚动时全屏重渲染。
          const beyond = event.nativeEvent.contentOffset.y > 80;
          const next = beyond ? feedKey : null;
          setBackToTopFeed((prev) => (prev === next ? prev : next));
        }}
        scrollEventThrottle={32}
        data={data as never[]}
        keyExtractor={(item: any, index) =>
          String(
            pageType === "court"
              ? item.caseId
              : (item.ticketId ?? item.ticketNo ?? index),
          )
        }
        renderItem={
          pageType === "court" ? (renderCase as never) : (renderTicket as never)
        }
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color="#ff3158" style={styles.loading} />
          ) : (
            <EmptyState
              style={styles.empty}
              messageStyle={styles.emptyMessage}
            />
          )
        }
        ListFooterComponent={
          <View>
            {loadingMore && (
              <ActivityIndicator color="#ff3158" style={styles.loading} />
            )}
            <View
              style={{ height: (data.length === 0 ? 44 : 60) + bottomInset }}
            />
          </View>
        }
        contentContainerStyle={[
          styles.listContent,
          data.length === 0 && styles.emptyListContent,
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
            tintColor="#ff3158"
          />
        }
        onEndReached={() => {
          if (hasMore && !loading && !loadingMore) void load(true);
        }}
        onEndReachedThreshold={0.4}
        windowSize={5}
        maxToRenderPerBatch={4}
        updateCellsBatchingPeriod={50}
        initialNumToRender={6}
      />
      {data.length > 0 && backToTopFeed === feedKey && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="回到顶部"
          onPress={() =>
            listRef.current?.scrollToOffset({ offset: 0, animated: true })
          }
          style={({ pressed }) => [
            styles.backToTop,
            { bottom: bottomInset + 88 },
            pressed && styles.backToTopPressed,
          ]}
        >
          <CachedImage
            accessible={false}
            source={require("../../../../assets/court/back-to-top.svg")}
            contentFit="contain"
            style={styles.backToTopIcon}
          />
        </Pressable>
      )}
      <CourtReviewerPromptModal
        visible={reviewerPromptVisible}
        onClose={() => setReviewerPromptVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    flex: 1,
    marginTop: 4,
    overflow: "hidden",
  },
  listContent: { paddingHorizontal: 16, paddingBottom: 0 },
  emptyListContent: { flexGrow: 1 },
  sectionTabs: {
    alignItems: "center",
    flexDirection: "row",
    height: 54,
    marginHorizontal: -16,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  sectionTab: {
    alignSelf: "stretch",
    justifyContent: "center",
    marginRight: 24,
    minWidth: 48,
    position: "relative",
  },
  sectionText: {
    color: "#656566",
    fontFamily: COURT_FONT_FAMILY,
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 22,
  },
  sectionSelected: { color: "#0D0D0F", fontSize: 16, fontWeight: "600" },
  sectionUnderline: {
    bottom: 8,
    height: 3,
    left: "50%",
    marginLeft: -6,
    position: "absolute",
    width: 12,
  },
  reviewAction: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
    marginLeft: "auto",
    minHeight: 44,
  },
  reviewActionIcon: { height: 16, width: 16 },
  reviewActionText: {
    color: "#656566",
    textAlign: "center",
    fontFamily: COURT_FONT_FAMILY,
    fontSize: 12,
    fontStyle: "normal",
    fontWeight: "500",
    lineHeight: 18,
  },
  feedRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 36,
    marginBottom: 8,
  },
  feedTabs: { alignItems: "center", flexDirection: "row", gap: 12 },
  feedTab: {
    alignItems: "center",
    backgroundColor: "#F0F1F2",
    borderRadius: 999,
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  feedTabSelected: {
    backgroundColor: "#FFF5F7",
    borderColor: "#FF99AD",
    borderWidth: 0.5,
  },
  feedText: {
    color: "#656566",
    fontFamily: COURT_FONT_FAMILY,
    fontSize: 12,
    fontStyle: "normal",
    fontWeight: "400",
    lineHeight: 18,
    textAlign: "center",
  },
  feedTextSelected: { color: "#FE1F4C", fontWeight: "500" },
  statsRow: {
    backgroundColor: "#fff",
    borderRadius: 8,
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 10,
    paddingVertical: 10,
  },
  statsLabel: { color: "#777", fontFamily: COURT_FONT_FAMILY, fontSize: 12 },
  statsValue: { color: "#111", fontWeight: "700" },
  judgeEntry: {
    backgroundColor: "#fff7f8",
    borderColor: "#ffe1e6",
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 10,
    padding: 12,
  },
  judgeTitle: {
    color: "#171717",
    fontFamily: COURT_FONT_FAMILY,
    fontSize: 14,
    fontWeight: "700",
  },
  judgeDesc: {
    color: "#888",
    fontFamily: COURT_FONT_FAMILY,
    fontSize: 11,
    marginTop: 4,
  },
  judgeArrow: {
    color: "#ff3158",
    fontSize: 23,
    position: "absolute",
    right: 12,
    top: 10,
  },
  empty: { flex: 1, minHeight: 146, width: 247 },
  emptyMessage: {
    color: "#999999",
    fontFamily: COURT_FONT_FAMILY,
    fontSize: 12,
    fontWeight: "400",
    lineHeight: 18,
  },
  backToTop: {
    position: "absolute",
    right: 12,
    width: 48,
    height: 48,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center",
    justifyContent: "center",
    boxShadow:
      "0px 2px 16px 0px rgba(0,0,0,0.05), 0px 4px 8px 0px rgba(0,0,0,0.08)",
  },
  backToTopPressed: { backgroundColor: "#F5F6F7" },
  backToTopIcon: { width: 28, height: 28 },
  loading: { marginVertical: 24 },
});
