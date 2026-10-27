import { Delete16Regular } from "@fluentui/react-native-icons";
import { useQuery } from "@tanstack/react-query";
import { memo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import type { Club } from "@/features/home/api/home.types";
import { colors, spacing } from "@/shared/theme/tokens";
import { EmptyState } from "@/shared/ui/AsyncStates";
import { CachedImage } from "@/shared/ui/CachedImage";
import { searchClubs, searchUsers, type SearchUser } from "../api/search.api";
import { getSearchHistoryEntry, type SearchHistoryEntry } from "../search-history";
import { searchTypography } from "../search-typography";

const defaultAvatar = require("../../../../assets/coms/avatar_default.webp");

const HistoryChip = memo(function HistoryChip({
  entry,
  type,
  onSearch,
}: {
  entry: SearchHistoryEntry;
  type: "club" | "user" | "message";
  onSearch: (entry: SearchHistoryEntry) => void;
}) {
  const category = entry.category ?? type;
  // Old keyword-only records can reuse the search cache to recover exact matches.
  const { data } = useQuery<{ items: readonly (Club | SearchUser)[] }>({
    queryKey: [category === "club" ? "club-search" : "user-search", entry.keyword],
    queryFn: ({ signal }) => category === "club"
      ? searchClubs(entry.keyword, 1, 20, signal)
      : searchUsers(entry.keyword, 1, 20, signal),
    enabled: category !== "message" && !entry.avatarUrl,
    staleTime: 5 * 60_000,
    retry: false,
  });
  const resolved = getSearchHistoryEntry(entry.keyword, data?.items ?? [], entry.entityId);
  const avatarUrl = entry.avatarUrl || resolved.avatarUrl;
  const handlePress = () => onSearch({ ...entry, avatarUrl, entityId: entry.entityId || resolved.entityId });

  return (
    <Pressable accessibilityRole="button" onPress={handlePress} style={styles.chip}>
      <CachedImage
        source={avatarUrl ? { uri: avatarUrl } : defaultAvatar}
        contentFit="cover"
        style={styles.avatar}
      />
      <Text numberOfLines={1} style={styles.keyword}>{entry.keyword}</Text>
    </Pressable>
  );
});

export function SearchHistory({
  history,
  type,
  onSearch,
  onClear,
}: {
  history: SearchHistoryEntry[];
  type: "club" | "user" | "message";
  onSearch: (entry: SearchHistoryEntry) => void;
  onClear: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.title}>搜索历史</Text>
        {history.length > 0 ? (
          <Pressable accessibilityRole="button" accessibilityLabel="清空搜索历史" hitSlop={12} onPress={onClear}>
            <Delete16Regular color="#808080" width={16} height={16} style={styles.deleteIcon} />
          </Pressable>
        ) : null}
      </View>
      {history.length > 0 ? (
        <View style={styles.list}>
          {history.map((entry) => (
            <HistoryChip key={`${entry.category ?? type}:${entry.entityId ? `entity:${entry.entityId}` : `keyword:${entry.keyword}`}`} entry={entry} type={type} onSearch={onSearch} />
          ))}
        </View>
      ) : (
        <EmptyState message="暂无搜索历史" messageStyle={searchTypography.regular12} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.md },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { ...searchTypography.medium14, color: "#0A0A0A" },
  deleteIcon: { width: 16, height: 16 },
  list: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    maxWidth: "100%",
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingLeft: 6,
    paddingRight: spacing.sm,
    paddingVertical: 3,
    borderRadius: 69,
    backgroundColor: "#F7F7F7",
  },
  avatar: { flexShrink: 0, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.border },
  keyword: { ...searchTypography.regular12, flexShrink: 1, color: "#0A0A0A" },
});
