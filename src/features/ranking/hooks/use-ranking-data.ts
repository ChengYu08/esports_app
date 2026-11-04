import { useAuthStore } from "@esports/auth";
import { useQuery } from "@tanstack/react-query";
import { fetchGames } from "@/features/home/api/home.api";
import { rankingApi } from "../api/ranking.api";
import { getRankingParams } from "../api/ranking.contract";
import type { RankingFilters } from "../api/ranking.types";

export function useRankingData(filters: RankingFilters, active = true) {
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.accessToken);
  const params = getRankingParams(filters);
  const isAuthenticated = Boolean(user && token);

  // 与首页共用游戏缓存和字段映射，避免榜单刷新后覆盖首页的品类数据。
  const games = useQuery({
    queryKey: ["home-games"],
    queryFn: ({ signal }) => fetchGames(signal),
    enabled: active && filters.boardCode !== "GOD",
  });
  const top = useQuery({
    queryKey: ["ranking", "top", params],
    queryFn: ({ signal }) => rankingApi.fetchTop(params, signal),
    enabled: active,
  });
  const myRank = useQuery({
    queryKey: ["ranking", "my", user?.id, token, params],
    queryFn: ({ signal }) => rankingApi.fetchMyRank(params, token!, signal),
    enabled: active && isAuthenticated,
    // Private data must not remain in an inactive account's cache.
    gcTime: 0,
    retry: false,
  });

  return { games, top, myRank, user, isAuthenticated };
}
