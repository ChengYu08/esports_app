import { useAuthStore } from "@esports/auth";
import { useQuery } from "@tanstack/react-query";
import { rankingApi } from "../api/ranking.api";
import { getRankingParams } from "../api/ranking.contract";
import type { RankingFilters } from "../api/ranking.types";

export function useRankingData(filters: RankingFilters) {
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.accessToken);
  const params = getRankingParams(filters);
  const isAuthenticated = Boolean(user && token);

  // Share the same game shape/cache with Home, while surfacing business errors here.
  const games = useQuery({
    queryKey: ["home-games"],
    queryFn: ({ signal }) => rankingApi.fetchGames(signal),
    enabled: filters.boardCode !== "GOD",
  });
  const top = useQuery({
    queryKey: ["ranking", "top", params],
    queryFn: ({ signal }) => rankingApi.fetchTop(params, signal),
  });
  const myRank = useQuery({
    queryKey: ["ranking", "my", user?.id, token, params],
    queryFn: ({ signal }) => rankingApi.fetchMyRank(params, token!, signal),
    enabled: isAuthenticated,
    // Private data must not remain in an inactive account's cache.
    gcTime: 0,
    retry: false,
  });

  return { games, top, myRank, user, isAuthenticated };
}
