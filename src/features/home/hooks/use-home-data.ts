import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { fetchBanners, fetchClubDetail, fetchClubGameModes, fetchClubPage, fetchCompanionPage, fetchGames, fetchPriceList } from "@/features/home/api/home.api";
import type { CompanionFilters, GameKey, HomeTab } from "@/features/home/api/home.types";

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

export function useClubDetail(id?: string) {
  return useQuery({ queryKey: ["club-detail", id], queryFn: () => fetchClubDetail(id as string), enabled: Boolean(id) });
}

export function useClubGameModes(gameId?: string) {
  return useQuery({ queryKey: ["club-game-modes", gameId], queryFn: () => fetchClubGameModes(gameId as string), enabled: Boolean(gameId) });
}

export function useClubCompanions(filters: CompanionFilters | null) {
  return useInfiniteQuery({
    queryKey: ["club-companions", filters],
    queryFn: ({ pageParam }) => fetchCompanionPage(filters as CompanionFilters, pageParam),
    enabled: Boolean(filters), initialPageParam: 1,
    getNextPageParam: (last) => last.hasMore ? last.nextPage : undefined,
  });
}

export function usePriceList(groupId?: string) {
  return useQuery({ queryKey: ["club-price-list", groupId], queryFn: () => fetchPriceList(groupId as string), enabled: Boolean(groupId) });
}
