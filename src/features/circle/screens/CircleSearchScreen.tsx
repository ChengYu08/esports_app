import { ChevronLeft24Regular, Delete20Regular, Search20Regular } from "@fluentui/react-native-icons";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fetchCircleHotTopics, type CircleHotTopic } from "@/features/circle/circle.api";
import { SYSTEM_FONT } from "@/shared/theme/typography";

const HISTORY_KEY = "circle.search.history";
const HISTORY_MAX = 10;
/** 热榜展示条数，对齐设计稿 Top10（后端最多返回 20）。 */
const HOT_RANK_LIMIT = 10;
/** 热榜前三名徽标底色，与设计稿 Brand/Orange/黄一致。 */
const RANK_BADGE_COLORS = ["#FE4267", "#FF943D", "#EDCB42"];

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
  const [input, setInput] = useState("");
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

  const history = historyQuery.data ?? [];
  const hotTopics = (hotTopicsQuery.data ?? []).slice(0, HOT_RANK_LIMIT);

  const addHistory = async (keyword: string) => {
    const list = await readHistory().catch(() => [] as string[]);
    const next = [keyword, ...list.filter((item) => item !== keyword)].slice(0, HISTORY_MAX);
    try {
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // 历史记录写失败不影响搜索跳转。
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

  const goResults = (params: { kw?: string; topic?: string }) => {
    if (params.kw) {
      void addHistory(params.kw);
    }
    router.push({ pathname: "/circle/search-results", params });
  };

  const submitSearch = () => {
    const keyword = input.trim();
    if (!keyword) {
      inputRef.current?.focus();
      return;
    }
    goResults({ kw: keyword });
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
        <Pressable
          accessibilityRole="search"
          style={styles.searchBox}
          onPress={() => {
            inputRef.current?.focus();
          }}
        >
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
            onSubmitEditing={submitSearch}
          />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="搜索"
          onPress={submitSearch}
          style={styles.submit}
        >
          <Text style={styles.submitText}>搜索</Text>
        </Pressable>
      </View>

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
                    setInput(keyword);
                    goResults({ kw: keyword });
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
              <HotTopicRow key={topic.topicId || topic.topicName} topic={topic} rank={index + 1} />
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function HotTopicRow({ topic, rank }: { topic: CircleHotTopic; rank: number }) {
  const topThree = rank <= RANK_BADGE_COLORS.length;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`搜索话题${topic.topicName}`}
      onPress={() => {
        router.push({
          pathname: "/circle/search-results",
          params: { topic: topic.topicName },
        });
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
  submit: { paddingHorizontal: 12, height: 44, justifyContent: "center" },
  submitText: {
    fontFamily: SYSTEM_FONT,
    color: "#0D0D0F",
    fontSize: 14,
    lineHeight: 22,
  },
  content: { flex: 1 },
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
});
