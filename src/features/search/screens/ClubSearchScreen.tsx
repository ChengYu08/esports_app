import { useAuthStore } from "@esports/auth";
import { ChevronLeft24Regular } from "@fluentui/react-native-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { Club } from "@/features/home/api/home.types";
import { MessageListItem } from "@/features/message/components/MessageListItem";
import { filterMessageConversations } from "@/features/message/message-search";
import { useMessageStore } from "@/features/message/message-store";
import { getConversationDisplayTitle } from "@/features/message/message-title";
import type { MessageListItemModel } from "@/features/message/message.types";
import {
  isSelfConversationId,
  normalizeSystemConversationId,
} from "@/features/message/system-conversations";
import { EmptyState, ErrorState, LoadingState } from "@/shared/ui/AsyncStates";
import type { SearchUser } from "../api/search.api";
import { ClubSearchCard } from "../components/ClubSearchCard";
import { SearchCategoryTabs } from "../components/SearchCategoryTabs";
import { SearchEmptyState } from "../components/SearchEmptyState";
import { SearchHistory } from "../components/SearchHistory";
import { UserSearchCard } from "../components/UserSearchCard";
import { useClubSearch } from "../hooks/use-club-search";
import { useSearchHistory } from "../hooks/use-search-history";
import { useUserSearch } from "../hooks/use-user-search";
import { getSearchHistoryEntry, type SearchHistoryEntry } from "../search-history";
import type { SearchCategory, SearchType } from "../search.types";
import { searchTypography } from "../search-typography";

type SearchResult = Club | SearchUser | MessageListItemModel;

const defaultConversationAvatar = require("../../../../assets/coms/avatar_default.webp");

const SEARCH_DEBOUNCE_MS = 300;
const MAX_SEARCH_LENGTH = 100;

function limitSearchInput(value: string) {
  // Match TextInput's length limit without leaving half an emoji at the end.
  return value.slice(0, MAX_SEARCH_LENGTH).replace(/[\uD800-\uDBFF]$/, "");
}

export default function ClubSearchScreen() {
  const insets = useSafeAreaInsets();
  const { type, clubId } = useLocalSearchParams<{
    type?: SearchType;
    clubId?: string;
  }>();
  const [category, setCategory] = useState<SearchCategory>(type === "user" ? "user" : "club");
  const searchType: SearchType = type === "message" ? "message" : category;
  const [input, setInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const { history, addHistory, clearHistory } = useSearchHistory(searchType);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userId = useAuthStore((state) => state.user?.id);
  const conversations = useMessageStore((state) => state.conversations);
  const blacklistedUserIds = useMessageStore((state) => state.blacklistedUserIds);
  const clubSearch = useClubSearch(searchType === "club" ? keyword : "");
  const userSearch = useUserSearch(searchType === "user" ? keyword : "");

  const cancelPendingSearch = useCallback(() => {
    if (searchTimer.current !== null) {
      clearTimeout(searchTimer.current);
      searchTimer.current = null;
    }
  }, []);

  useEffect(() => {
    return cancelPendingSearch;
  }, [cancelPendingSearch]);

  const handleInputChange = (value: string) => {
    const limited = limitSearchInput(value);
    setInput(limited);
    cancelPendingSearch();
    const next = limited.trim();
    if (!next || searchType === "message") {
      setKeyword(next);
      return;
    }
    searchTimer.current = setTimeout(() => {
      searchTimer.current = null;
      setKeyword(next);
    }, SEARCH_DEBOUNCE_MS);
  };

  const submit = (value = input) => {
    cancelPendingSearch();
    const next = limitSearchInput(value).trim();
    if (!next) {
      return;
    }
    setInput(next);
    setKeyword(next);
    const results = searchType === "club" ? clubSearch.data?.items : userSearch.data?.items;
    addHistory(getSearchHistoryEntry(next, searchType === "message" ? [] : results ?? []));
  };

  const handleSubmit = () => {
    submit();
  };

  const selectCategory = (nextCategory: SearchCategory) => {
    cancelPendingSearch();
    setCategory(nextCategory);
    setKeyword(input.trim());
  };

  const searchHistory = (entry: SearchHistoryEntry) => {
    cancelPendingSearch();
    const next = limitSearchInput(entry.keyword).trim();
    if (entry.category) {
      setCategory(entry.category);
    }
    setInput(next);
    setKeyword(next);
    addHistory({ ...entry, keyword: next });
  };

  const recordClub = useCallback((club: Club) => {
    addHistory({ keyword: club.name, avatarUrl: club.coverUrl, entityId: club.id, category: "club" });
  }, [addHistory]);

  const recordUser = useCallback((user: SearchUser) => {
    addHistory({ keyword: user.nickname, avatarUrl: user.headImage, entityId: String(user.userId), category: "user" });
  }, [addHistory]);

  const searching = searchType === "message" || keyword.length > 0;
  const messageItems = useMemo<MessageListItemModel[]>(
    () =>
      filterMessageConversations(conversations, keyword, userId, blacklistedUserIds).map(
        (conversation) => ({
          ...conversation,
          id: normalizeSystemConversationId(conversation.id),
          title: getConversationDisplayTitle(
            conversation.id,
            conversation.title,
            conversation.note,
          ),
          kind: "conversation",
          avatar: conversation.avatar || defaultConversationAvatar,
        }),
      ),
    [blacklistedUserIds, conversations, keyword, userId],
  );
  const search = searchType === "club" ? clubSearch : userSearch;
  const items =
    searchType === "message" ? messageItems : (search.data?.items ?? []);
  const placeholder = searchType === "message" ? "搜索聊天用户" : "搜索俱乐部或陪玩";

  const retrySearch = () => {
    search.refetch();
  };

  const handleMessagePress = (item: MessageListItemModel) => {
    if (isSelfConversationId(item.id, userId)) return;
    router.push({
      pathname: "/chat/[id]",
      params: {
        id: normalizeSystemConversationId(item.id),
        title: item.title,
        avatar: typeof item.avatar === "string" ? item.avatar : "",
        clubId: item.clubId || "",
      },
    });
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.nav}>
        <Pressable
          accessibilityLabel="返回"
          hitSlop={12}
          onPress={() => router.back()}
          style={styles.back}
        >
          <ChevronLeft24Regular width={24} height={24} color="#0A0A0A" />
        </Pressable>
        <TextInput
          autoFocus
          clearButtonMode="while-editing"
          maxLength={MAX_SEARCH_LENGTH}
          onChangeText={handleInputChange}
          onSubmitEditing={handleSubmit}
          placeholder={placeholder}
          placeholderTextColor="#CCCCCC"
          returnKeyType="search"
          style={styles.input}
          value={input}
        />
        <Pressable
          accessibilityRole="button"
          onPress={handleSubmit}
          style={styles.submit}
        >
          <Text style={[styles.submitText, input.trim().length > 0 && styles.submitActive]}>搜索</Text>
        </Pressable>
      </View>
      {searching && searchType !== "message" ? (
        <SearchCategoryTabs value={category} onChange={selectCategory} />
      ) : null}
      {searching ? (
        <FlatList<SearchResult>
          key={searchType}
          contentContainerStyle={[styles.results, items.length === 0 && styles.emptyResults]}
          data={items as SearchResult[]}
          keyExtractor={(item) =>
            searchType === "club"
              ? (item as Club).id
              : searchType === "user"
                ? String((item as SearchUser).profileId)
                : (item as MessageListItemModel).id
          }
          ListEmptyComponent={
            searchType === "message" ? (
              <EmptyState message="暂无相关聊天用户" />
            ) : search.isLoading ? (
              <LoadingState messageStyle={searchTypography.regular12} />
            ) : search.isError ? (
              <ErrorState onRetry={retrySearch} messageStyle={searchTypography.regular14} retryTextStyle={searchTypography.regular12} />
            ) : (
              <SearchEmptyState />
            )
          }
          renderItem={({ item, index }) =>
            searchType === "club" ? (
              <ClubSearchCard club={item as Club} keyword={keyword} onSelect={recordClub} />
            ) : searchType === "user" ? (
              <UserSearchCard user={item as SearchUser} clubId={clubId} keyword={keyword} onSelect={recordUser} />
            ) : (
              <MessageListItem
                item={item as MessageListItemModel}
                isLast={index === items.length - 1}
                onPress={handleMessagePress}
              />
            )
          }
          ItemSeparatorComponent={searchType === "message" ? () => <View style={styles.separator} /> : undefined}
          initialNumToRender={searchType === "message" ? undefined : 8}
          windowSize={searchType === "message" ? undefined : 5}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <SearchHistory history={history} type={searchType} onSearch={searchHistory} onClear={clearHistory} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFFFFF" },
  nav: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
  },
  back: { width: 56, height: 44, alignItems: "center", justifyContent: "center" },
  input: {
    ...searchTypography.regular14,
    flex: 1,
    height: 36,
    paddingHorizontal: 12,
    paddingVertical: 0,
    borderRadius: 8,
    backgroundColor: "#F7F7F7",
    color: "#111",
    textAlignVertical: "center",
  },
  submit: { width: 56, height: 44, paddingLeft: 12, paddingRight: 16, alignItems: "center", justifyContent: "center" },
  submitText: {
    ...searchTypography.medium14,
    color: "#FF708D",
  },
  submitActive: { color: "#FE1F4C" },
  results: { flexGrow: 1, paddingVertical: 12 },
  emptyResults: { paddingVertical: 0 },
  separator: { height: 8, backgroundColor: "#F7F7F7", marginVertical: 8 },
});
