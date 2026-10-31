import { useQueries, useQueryClient } from "@tanstack/react-query";
import { useIsFocused } from "expo-router";
import { useCallback } from "react";

import { fetchClubOnlineCount } from "@/features/home/api/home.api";
import type { Club } from "@/features/home/api/home.types";

/** 首页在线陪玩按当前游戏范围统计，返回首页或下拉刷新时同步重新查询。 */
export function useClubOnlineCounts(clubs: readonly Club[], gameIds?: readonly number[], enabled = true) {
  const focused = useIsFocused();
  const queryClient = useQueryClient();
  const uniqueClubs = Array.from(new Map(clubs.map((club) => [club.id, club])).values());
  const queries = useQueries({
    queries: uniqueClubs.map((club) => {
      const countedGames = Array.from(new Set(club.gameIds ?? []))
        .filter((id) => !gameIds || gameIds.includes(id))
        .sort((a, b) => a - b);
      return {
        queryKey: ["club-online-count", club.id, countedGames] as const,
        queryFn: ({ signal }: { signal: AbortSignal }) => fetchClubOnlineCount(club.id, countedGames, signal),
        enabled: enabled && focused,
        staleTime: 0,
        retry: 1,
      };
    }),
  });
  const counts: Record<string, number> = {};
  queries.forEach((query, index) => {
    if (!query.isError && query.data != null) {
      counts[uniqueClubs[index].id] = query.data;
    }
  });
  const refetch = useCallback(
    () => queryClient.refetchQueries({ queryKey: ["club-online-count"], type: "active" }),
    [queryClient],
  );
  return { counts, refetch, isRefetching: queries.some((query) => query.isRefetching) };
}
