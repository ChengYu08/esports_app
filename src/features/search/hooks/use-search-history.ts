import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { addSearchHistoryEntry, parseSearchHistory, type SearchHistoryEntry } from "../search-history";
import { GLOBAL_SEARCH_HISTORY_KEY, loadGlobalSearchHistory } from "../search-history-storage";
import type { SearchType } from "../search.types";

export function useSearchHistory(type: SearchType) {
  const queryClient = useQueryClient();
  const storageKey = type === "message" ? "search.message.history" : GLOBAL_SEARCH_HISTORY_KEY;
  const queryKey = ["search-history", storageKey];
  const queryOptions = {
    queryKey,
    queryFn: async () => storageKey === GLOBAL_SEARCH_HISTORY_KEY
      ? loadGlobalSearchHistory(AsyncStorage)
      : parseSearchHistory(await AsyncStorage.getItem(storageKey)),
    staleTime: Infinity,
  };
  const { data: history = [] } = useQuery(queryOptions);
  const { mutate } = useMutation({
    // Serialize saves and clears so fast selections cannot overwrite each other.
    scope: { id: storageKey },
    mutationFn: async (entry: SearchHistoryEntry | null) => {
      const previous = await queryClient.ensureQueryData(queryOptions);
      const next = entry ? addSearchHistoryEntry(previous, entry) : [];
      await AsyncStorage.setItem(storageKey, JSON.stringify(next));
      queryClient.setQueryData(queryKey, next);
    },
  });
  const addHistory = useCallback((entry: SearchHistoryEntry) => {
    mutate({ ...entry, category: entry.category ?? (type === "message" ? undefined : type) });
  }, [mutate, type]);
  const clearHistory = useCallback(() => mutate(null), [mutate]);

  return { history, addHistory, clearHistory };
}
