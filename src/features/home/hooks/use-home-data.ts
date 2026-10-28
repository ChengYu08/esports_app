import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { fetchBanners, fetchClubDetail, fetchClubGameModes, fetchClubPage, fetchCompanionPage, fetchGameCategories, fetchGames, fetchPriceList } from "@/features/home/api/home.api";
import type { ClubFilters, CompanionFilters, HomeTab } from "@/features/home/api/home.types";

export function useHomeBanners(tab: HomeTab) {
  return useQuery({
    queryKey: ["home-banners", tab],
    queryFn: () => fetchBanners(tab),
  });
}

export function useHomeGames() {
  return useQuery({ queryKey: ["home-games"], queryFn: ({ signal }) => fetchGames(signal) });
}

export function useHomeGameCategories() {
  return useQuery({
    queryKey: ["home-game-categories"],
    queryFn: ({ signal }) => fetchGameCategories(signal),
  });
}

export function useHomeClubs(tab: HomeTab, filters: ClubFilters) {
  return useInfiniteQuery({
    queryKey: ["home-clubs", tab, filters],
    enabled: tab === "home",
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => fetchClubPage(filters, pageParam, 10, signal),
    getNextPageParam: (last) => (last.hasMore ? last.nextPage : undefined),
  });
}

export function useClubDetail(id?: string) {
  return useQuery({ queryKey: ["club-detail", id], queryFn: ({ signal }) => fetchClubDetail(id as string, signal), enabled: Boolean(id) });
}

export function useClubGameModes(gameId?: string) {
  return useQuery({ queryKey: ["club-game-modes", gameId], queryFn: ({ signal }) => fetchClubGameModes(gameId as string, signal), enabled: Boolean(gameId) });
}

export function useClubCompanions(filters: CompanionFilters | null) {
  return useInfiniteQuery({
    queryKey: ["club-companions", filters],
    queryFn: ({ pageParam, signal }) => fetchCompanionPage(filters as CompanionFilters, pageParam, 50, signal),
    enabled: Boolean(filters), initialPageParam: 1,
    getNextPageParam: (last) => last.hasMore ? last.nextPage : undefined,
  });
}

export function usePriceList(groupId?: string) {
  return useQuery({ queryKey: ["club-price-list", groupId], queryFn: ({ signal }) => fetchPriceList(groupId as string, signal), enabled: Boolean(groupId) });
}
