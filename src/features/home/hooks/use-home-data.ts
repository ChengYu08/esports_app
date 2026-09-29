import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { fetchBanners, fetchClubPage, fetchGames } from "@/features/home/api/home.api";
import type { GameKey, HomeTab } from "@/features/home/api/home.types";

export function useHomeBanners(tab: HomeTab) {
  return useQuery({
    queryKey: ["home-banners", tab],
    queryFn: () => fetchBanners(tab),
  });
}

export function useHomeGames() {
  return useQuery({ queryKey: ["home-games"], queryFn: fetchGames });
}

export function useHomeClubs(tab: HomeTab, game: GameKey) {
  return useInfiniteQuery({
    queryKey: ["home-clubs", tab, game],
    enabled: tab === "home" && game.length > 0,
    initialPageParam: 1,
    queryFn: ({ pageParam }) => fetchClubPage(game, pageParam),
    getNextPageParam: (last) => (last.hasMore ? last.nextPage : undefined),
  });
}
