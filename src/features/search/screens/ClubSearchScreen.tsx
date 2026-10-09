import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ClubCard } from "@/features/home/components/ClubCard";
import type { Club } from "@/features/home/api/home.types";
import { MessageListItem } from "@/features/message/components/MessageListItem";
import { filterMessageConversations } from "@/features/message/message-search";
import { useMessageStore } from "@/features/message/message-store";
import type { MessageListItemModel } from "@/features/message/message.types";
import { EmptyState, ErrorState, LoadingState } from "@/shared/ui/AsyncStates";
import { DOUYIN_SANS } from "@/shared/theme/typography";
import { useClubSearch } from "../hooks/use-club-search";
import { useUserSearch } from "../hooks/use-user-search";
import type { SearchUser } from "../api/search.api";

type SearchType = "club" | "user" | "message";
type SearchResult = Club | SearchUser | MessageListItemModel;

const defaultConversationAvatar = require("../../../../assets/message/avatar-wangzhe.svg");

const MAX_HISTORY = 10;

export default function ClubSearchScreen() {
  const insets = useSafeAreaInsets();
  const { type, clubId } = useLocalSearchParams<{ type?: SearchType; clubId?: string }>();
  const searchType: SearchType = type === "user" || type === "message" ? type : "club";
  const historyKey = `search.${searchType}.history`;
  const [input, setInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const conversations = useMessageStore((state) => state.conversations);
  const clubSearch = useClubSearch(searchType === "club" ? keyword : "");
  const userSearch = useUserSearch(searchType === "user" ? keyword : "");

  useEffect(() => {
    void AsyncStorage.getItem(historyKey).then((value) => {
      if (!value) return;
      try { setHistory(JSON.parse(value) as string[]); } catch { setHistory([]); }
    });
  }, [historyKey]);

  const submit = (value = input) => {
    const next = value.trim();
    if (!next) return;
    setInput(next);
    setKeyword(next);
    const nextHistory = [next, ...history.filter((item) => item !== next)].slice(0, MAX_HISTORY);
    setHistory(nextHistory);
    void AsyncStorage.setItem(historyKey, JSON.stringify(nextHistory));
  };

  const clearHistory = () => {
    setHistory([]);
    void AsyncStorage.removeItem(historyKey);
  };

  const searching = searchType === "message" || keyword.length > 0;
  const messageItems = useMemo<MessageListItemModel[]>(() =>
    filterMessageConversations(conversations, keyword).map((conversation) => ({
      ...conversation,
      kind: "conversation",
      avatar: conversation.avatar || defaultConversationAvatar,
    })), [conversations, keyword]);
  const search = searchType === "club" ? clubSearch : userSearch;
  const items = searchType === "message" ? messageItems : search.data?.items ?? [];
  const placeholder = searchType === "club" ? "搜索俱乐部" : searchType === "user" ? "搜索大神昵称或ID" : "搜索聊天用户";

  const handleMessagePress = (item: MessageListItemModel) => {
    router.push({
      pathname: "/chat/[id]",
      params: {
        id: item.id,
        title: item.title,
        avatar: typeof item.avatar === "string" ? item.avatar : "",
      },
    });
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.nav}>
        <Pressable accessibilityLabel="返回" hitSlop={12} onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <TextInput
          autoFocus
          clearButtonMode="while-editing"
          onChangeText={setInput}
          onSubmitEditing={() => submit()}
          placeholder={placeholder}
          placeholderTextColor="#CCCCCC"
          returnKeyType="search"
          style={styles.input}
          value={input}
        />
        <Pressable accessibilityRole="button" onPress={() => submit()} style={styles.submit}>
          <Text style={styles.submitText}>搜索</Text>
        </Pressable>
      </View>
      {searching ? (
        <FlatList<SearchResult>
          contentContainerStyle={styles.results}
          data={items as SearchResult[]}
          keyExtractor={(item) => searchType === "club" ? (item as Club).id : searchType === "user" ? String((item as SearchUser).profileId) : (item as MessageListItemModel).id}
          ListEmptyComponent={searchType === "message" ? <EmptyState message="暂无相关聊天用户" /> : search.isLoading ? <LoadingState /> : search.isError ? <ErrorState onRetry={() => void search.refetch()} /> : <EmptyState message={searchType === "club" ? "暂无相关俱乐部" : "暂无相关用户"} />}
          renderItem={({ item, index }) => searchType === "club" ? <ClubCard club={item as Club} /> : searchType === "user" ? <UserSearchCard user={item as SearchUser} clubId={clubId} /> : <MessageListItem item={item as MessageListItemModel} isLast={index === items.length - 1} onPress={handleMessagePress} />}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.historyWrap}>
          <View style={styles.historyHeader}><Text style={styles.title}>搜索历史</Text>{history.length > 0 && <Pressable onPress={clearHistory}><Text style={styles.clear}>清空</Text></Pressable>}</View>
          {history.length > 0 ? <View style={styles.historyList}>{history.map((item) => <Pressable key={item} onPress={() => submit(item)} style={styles.historyItem}><Text style={styles.historyText}>{item}</Text></Pressable>)}</View> : <EmptyState message="暂无搜索历史" />}
        </View>
      )}
    </View>
  );
}

function UserSearchCard({ user, clubId }: { user: SearchUser; clubId?: string }) {
  return (
    <Pressable style={styles.userCard} onPress={() => router.push({ pathname: "/profile", params: { clubId: clubId || String(user.clubId), userId: String(user.userId) } })}>
      <View style={styles.userAvatar}>{user.headImage ? <Image source={{ uri: user.headImage }} style={styles.userAvatarImage} /> : <Text style={styles.userAvatarText}>{user.nickname.slice(0, 1)}</Text>}</View>
      <View style={styles.userCopy}><Text numberOfLines={1} style={styles.userName}>{user.nickname}</Text><Text numberOfLines={1} style={styles.userClub}>{user.clubName || "陪玩用户"}</Text><Text numberOfLines={1} style={styles.userSignature}>{user.signature || "暂无个人简介"}</Text></View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFFFFF" },
  nav: { height: 52, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, gap: 8 },
  back: { width: 32, alignItems: "flex-start" },
  backText: { color: "#111", fontSize: 34, fontWeight: "300", lineHeight: 28 },
  input: { flex: 1, height: 36, paddingHorizontal: 12, paddingVertical: 0, borderRadius: 8, backgroundColor: "#F7F7F7", fontFamily: DOUYIN_SANS, color: "#111", fontSize: 14 },
  submit: { width: 44, alignItems: "flex-end" },
  submitText: { fontFamily: DOUYIN_SANS, color: "#FF708D", fontSize: 14, lineHeight: 22 },
  historyWrap: { flex: 1, paddingHorizontal: 16, paddingTop: 20 },
  historyHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontFamily: DOUYIN_SANS, color: "#111", fontSize: 16, fontWeight: "600" },
  clear: { fontFamily: DOUYIN_SANS, color: "#999", fontSize: 13 },
  historyList: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 16 },
  historyItem: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: "#F7F7F7" },
  historyText: { fontFamily: DOUYIN_SANS, color: "#666", fontSize: 13 },
  noHistory: { marginTop: 80, textAlign: "center", fontFamily: DOUYIN_SANS, color: "#999", fontSize: 13 },
  results: { flexGrow: 1, paddingTop: 16, paddingBottom: 24 },
  separator: { height: 8, backgroundColor: "#F7F7F7", marginVertical: 8 },
  userCard: { minHeight: 76, marginHorizontal: 16, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 12 },
  userAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#EDEDED", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  userAvatarImage: { width: "100%", height: "100%" },
  userAvatarText: { fontFamily: DOUYIN_SANS, color: "#999", fontSize: 22 },
  userCopy: { flex: 1, gap: 3 },
  userName: { fontFamily: DOUYIN_SANS, color: "#111", fontSize: 15, fontWeight: "600" },
  userClub: { fontFamily: DOUYIN_SANS, color: "#666", fontSize: 12 },
  userSignature: { fontFamily: DOUYIN_SANS, color: "#999", fontSize: 12 },
});
