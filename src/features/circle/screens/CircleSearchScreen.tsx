import { ChevronLeft24Regular, Delete20Regular, DismissCircle16Filled, Search20Regular } from "@fluentui/react-native-icons";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from "@esports/auth";

import { fetchCircleHotTopics, fetchCircleSearchPage, type CircleHotTopic } from "@/features/circle/circle.api";
import type { CircleVideoPost } from "@/features/circle/circle-data";
import { CircleSearchCard } from "@/features/circle/components/CircleSearchCard";
import { CircleTopicIcon } from "@/features/circle/components/CircleActionIcons";
import { EmptyState } from "@/shared/ui/AsyncStates";
import { SYSTEM_FONT } from "@/shared/theme/typography";

const HISTORY_KEY = "circle.search.history";
const HISTORY_MAX = 10;
/** 热榜展示条数，对齐设计稿 Top10（后端最多返回 20）。 */
const HOT_RANK_LIMIT = 10;
/** 热榜前三名徽标底色，与设计稿 Brand/Orange/黄一致。 */
const RANK_BADGE_COLORS = ["#FE4267", "#FF943D", "#EDCB42"];

/** 搜索态：keyword 为实际查询词（话题已去掉 # 前缀）。 */
type CircleSearchState = {
  keyword: string;
  isTopic: boolean;
};

async function readHistory(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    const list = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export default function CircleSearchScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((state) => state.accessToken);
  const [input, setInput] = useState("");
  const [search, setSearch] = useState<CircleSearchState | null>(null);
  const inputRef = useRef<TextInput>(null);

  const historyQuery = useQuery({
    queryKey: ["circle-search-history"],
    queryFn: readHistory,
    staleTime: Infinity,
  });
  const hotTopicsQuery = useQuery({
    queryKey: ["circle-hot-topics"],
    queryFn: ({ signal }) => fetchCircleHotTopics(signal),
    staleTime: 60_000,
  });

  const resultsQuery = useInfiniteQuery({
    queryKey: [
      "circle-search-results",
      search?.keyword ?? "",
      search?.isTopic ?? false,
      accessToken ?? "guest",
    ],
    enabled: search !== null && Boolean(search.keyword),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      fetchCircleSearchPage({
        keyword: search?.keyword ?? "",
        keywordType: search?.isTopic ? 1 : undefined,
        cursor: pageParam,
        token: accessToken ?? undefined,
        signal,
      }),
    getNextPageParam: (lastPage) =>
      lastPage.hasMore && lastPage.nextCursor ? lastPage.nextCursor : undefined,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  const posts = useMemo(() => {
    const seen = new Set<string>();
    return (resultsQuery.data?.pages.flatMap((page) => page.list) ?? []).filter((post) => {
      if (seen.has(post.id)) {
        return false;
      }
      seen.add(post.id);
      return true;
    });
  }, [resultsQuery.data]);

  const history = historyQuery.data ?? [];
  const hotTopics = (hotTopicsQuery.data ?? []).slice(0, HOT_RANK_LIMIT);

  const addHistory = async (raw: string) => {
    const keyword = raw.trim();
    if (!keyword) {
      return;
    }
    const list = await readHistory().catch(() => [] as string[]);
    const next = [keyword, ...list.filter((item) => item !== keyword)].slice(0, HISTORY_MAX);
    try {
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // 历史记录写失败不影响搜索流程。
    }
    queryClient.setQueryData(["circle-search-history"], next);
  };

  const clearHistory = async () => {
    try {
      await AsyncStorage.removeItem(HISTORY_KEY);
    } catch {
      // 忽略清空失败，界面仍回到空历史。
    }
    queryClient.setQueryData(["circle-search-history"], []);
  };

  /** 提交搜索：# 前缀走话题精确搜索，其余跨字段模糊。 */
  const runSearch = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      inputRef.current?.focus();
      return;
    }
    void addHistory(trimmed);
    setInput(trimmed);
    if (trimmed.startsWith("#")) {
      const topic = trimmed.slice(1).trim();
      if (topic) {
        setSearch({ keyword: topic, isTopic: true });
        return;
      }
    }
    setSearch({ keyword: trimmed, isTopic: false });
  };

  const clearInput = () => {
    setInput("");
    setSearch(null);
    inputRef.current?.focus();
  };

  const openHotTopic = (topic: CircleHotTopic) => {
    setInput(`#${topic.topicName}`);
    setSearch({ keyword: topic.topicName, isTopic: true });
  };

  const openCard = (post: CircleVideoPost) => {
    if (search === null) {
      return;
    }
    if (search.isTopic) {
      router.push({ pathname: "/circle/search-results", params: { topic: search.keyword } });
      return;
    }
    router.push({ pathname: "/circle/search-results", params: { kw: search.keyword } });
  };

  const handleEndReached = ({ nativeEvent }: { nativeEvent: { contentOffset: { y: number }; layoutMeasurement: { height: number }; contentSize: { height: number } } }) => {
    if (!resultsQuery.hasNextPage || resultsQuery.isFetchingNextPage) {
      return;
    }
    if (nativeEvent.contentSize.height <= 0) {
      return;
    }
    const distanceToBottom =
      nativeEvent.contentSize.height - nativeEvent.contentOffset.y - nativeEvent.layoutMeasurement.height;
    if (distanceToBottom < 200) {
      void resultsQuery.fetchNextPage();
    }
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="返回"
          onPress={() => {
            router.back();
          }}
          style={styles.back}
        >
          <ChevronLeft24Regular color="#0D0D0F" style={styles.backIcon} />
        </Pressable>
        <View style={styles.searchBox}>
          <Search20Regular color="#CACACC" style={styles.searchIcon} />
          <TextInput
            ref={inputRef}
            value={input}
            onChangeText={setInput}
            placeholder="搜索盼友圈内容"
            placeholderTextColor="#CACACC"
            style={styles.searchInput}
            maxLength={100}
            returnKeyType="search"
            onSubmitEditing={() => {
              runSearch(input);
            }}
          />
          {input.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="清空输入"
              onPress={clearInput}
              style={styles.clearInput}
            >
              <DismissCircle16Filled color="#CACACC" style={styles.clearInputIcon} />
            </Pressable>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="搜索"
          onPress={() => {
            runSearch(input);
          }}
          style={styles.submit}
        >
          <Text style={styles.submitText}>搜索</Text>
        </Pressable>
      </View>

      {search === null ? (
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentInner}
          keyboardShouldPersistTaps="handled"
        >
          {history.length > 0 ? (
            <View style={styles.historyBlock}>
              <View style={styles.blockTitleRow}>
                <Text style={styles.blockTitle}>搜索历史</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="清空搜索历史"
                  onPress={() => {
                    void clearHistory();
                  }}
                  style={styles.clearButton}
                >
                  <Delete20Regular color="#656566" style={styles.clearIcon} />
                </Pressable>
              </View>
              <View style={styles.tagWrap}>
                {history.map((keyword) => (
                  <Pressable
                    key={keyword}
                    accessibilityRole="button"
                    accessibilityLabel={`搜索${keyword}`}
                    onPress={() => {
                      runSearch(keyword);
                    }}
                    style={styles.tag}
                  >
                    <Text style={styles.tagText} numberOfLines={1}>
                      {keyword}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          {hotTopics.length > 0 ? (
            <View style={styles.hotBlock}>
              <View style={styles.blockTitleRow}>
                <Text style={styles.blockTitle}>话题热榜</Text>
              </View>
              {hotTopics.map((topic, index) => (
                <HotTopicRow key={topic.topicId || topic.topicName} topic={topic} rank={index + 1} onOpen={openHotTopic} />
              ))}
            </View>
          ) : null}
        </ScrollView>
      ) : (
        <View style={styles.resultsRoot}>
          <LinearGradient colors={["#FFFFFF", "#F5F6F7"]} style={styles.resultsGradient} pointerEvents="none" />
          {search.isTopic ? (
            <View style={styles.topicHeader}>
              <CircleTopicIcon color="#0D0D0F" />
              <View style={styles.topicColumn}>
                <Text style={styles.topicTitle} numberOfLines={1}>
                  {search.keyword}
                </Text>
              </View>
            </View>
          ) : null}
          {resultsQuery.isLoading ? (
            <View style={styles.resultsFill}>
              <ActivityIndicator color="#979799" />
            </View>
          ) : resultsQuery.isError ? (
            <Pressable
              style={styles.resultsFill}
              onPress={() => {
                void resultsQuery.refetch();
              }}
            >
              <Text style={styles.errorText}>加载失败，点击重试</Text>
            </Pressable>
          ) : posts.length === 0 ? (
            <View style={styles.resultsFill} pointerEvents="none">
              <EmptyState
                message={search.isTopic ? "该话题还没有视频" : "没有找到相关内容，换个词试试吧"}
              />
            </View>
          ) : (
            <ScrollView
              style={styles.resultsList}
              contentContainerStyle={styles.resultsListInner}
              onScroll={handleEndReached}
              scrollEventThrottle={200}
            >
              <View style={styles.resultsGrid}>
                <View style={styles.column}>
                  {posts
                    .filter((_, index) => index % 2 === 0)
                    .map((post) => (
                      <CircleSearchCard key={post.id} post={post} onPress={openCard} />
                    ))}
                </View>
                <View style={styles.column}>
                  {posts
                    .filter((_, index) => index % 2 === 1)
                    .map((post) => (
                      <CircleSearchCard key={post.id} post={post} onPress={openCard} />
                    ))}
                </View>
              </View>
              <View style={styles.loadMoreFooter}>
                {resultsQuery.isFetchingNextPage ? (
                  <ActivityIndicator color="#979799" size="small" />
                ) : (
                  <Text style={styles.footerText}>- 到底了 -</Text>
                )}
              </View>
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
}

function HotTopicRow({
  topic,
  rank,
  onOpen,
}: {
  topic: CircleHotTopic;
  rank: number;
  onOpen: (topic: CircleHotTopic) => void;
}) {
  const topThree = rank <= RANK_BADGE_COLORS.length;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`搜索话题${topic.topicName}`}
      onPress={() => {
        onOpen(topic);
      }}
      style={styles.rankRow}
    >
      <View style={[styles.rankBadge, topThree && { backgroundColor: RANK_BADGE_COLORS[rank - 1] }]}>
        <Text style={[styles.rankBadgeText, !topThree && styles.rankBadgeTextGray]}>{rank}</Text>
      </View>
      <Text style={styles.rankTitle} numberOfLines={1}>
        #{topic.topicName}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFFFFF" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 12,
    paddingRight: 4,
    paddingBottom: 8,
    backgroundColor: "#FFFFFF",
  },
  back: { width: 36, height: 44, alignItems: "center", justifyContent: "center" },
  backIcon: { width: 24, height: 24 },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 36,
    borderRadius: 8,
    backgroundColor: "#F5F6F7",
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  searchIcon: { width: 20, height: 20 },
  searchInput: {
    flex: 1,
    fontFamily: SYSTEM_FONT,
    color: "#0D0D0F",
    fontSize: 14,
    lineHeight: 22,
    padding: 0,
  },
  clearInput: { width: 24, height: 24, alignItems: "center", justifyContent: "center" },
  clearInputIcon: { width: 18, height: 18 },
  submit: { paddingHorizontal: 12, height: 44, justifyContent: "center" },
  submitText: {
    fontFamily: SYSTEM_FONT,
    color: "#0D0D0F",
    fontSize: 14,
    lineHeight: 22,
  },
  content: { flex: 1, backgroundColor: "#FFFFFF" },
  contentInner: { paddingBottom: 24 },
  historyBlock: { paddingTop: 16, paddingBottom: 8 },
  blockTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  blockTitle: {
    fontFamily: SYSTEM_FONT,
    color: "#0D0D0F",
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "600",
  },
  clearButton: { width: 32, height: 28, alignItems: "center", justifyContent: "center" },
  clearIcon: { width: 18, height: 18 },
  tagWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  tag: {
    maxWidth: "100%",
    borderRadius: 999,
    backgroundColor: "#F5F6F7",
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  tagText: {
    fontFamily: SYSTEM_FONT,
    color: "#656566",
    fontSize: 12,
    lineHeight: 18,
  },
  hotBlock: { paddingTop: 16, paddingBottom: 12 },
  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  rankBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 4,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F0F1F2",
  },
  rankBadgeText: {
    fontFamily: SYSTEM_FONT,
    color: "#FFFFFF",
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "600",
  },
  rankBadgeTextGray: { color: "#7F7F80" },
  rankTitle: {
    flex: 1,
    fontFamily: SYSTEM_FONT,
    color: "#656566",
    fontSize: 14,
    lineHeight: 22,
  },
  resultsRoot: { flex: 1, backgroundColor: "#F5F6F7" },
  resultsGradient: { position: "absolute", top: 0, left: 0, right: 0, height: 80 },
  topicHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
  },
  topicColumn: { flex: 1, gap: 4 },
  topicTitle: {
    fontFamily: SYSTEM_FONT,
    color: "#0D0D0F",
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
  },
  resultsFill: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorText: { fontFamily: SYSTEM_FONT, color: "#656566", fontSize: 14 },
  resultsList: { flex: 1 },
  resultsListInner: { padding: 8 },
  resultsGrid: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  column: { flex: 1, gap: 8 },
  loadMoreFooter: {
    paddingVertical: 12,
    alignItems: "center",
  },
  footerText: {
    fontFamily: SYSTEM_FONT,
    color: "#CACACC",
    fontSize: 12,
    lineHeight: 18,
  },
});
