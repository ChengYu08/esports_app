import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { fetchBanners, fetchClubDetail, fetchClubGameModes, fetchClubPage, fetchCompanionPage, fetchGameCategories, fetchGames, fetchPriceList } from "@/features/home/api/home.api";
import type { ClubFilters, CompanionFilters, HomeTab } from "@/features/home/api/home.types";

export function useHomeBanners(tab: HomeTab) {
  return useQuery({
    queryKey: ["home-banner-slots"],
    queryFn: ({ signal }) => fetchBanners(signal),
    enabled: tab === "home",
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
    // queryKey 不含 tab：切到其他顶部频道（enabled 变 false）时，隐藏中的首页列表数据保持在缓存中不塌缩；切回时 stale 查询自动后台重拉
    queryKey: ["home-clubs", filters],
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
