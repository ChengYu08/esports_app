import {
  fetchBanners,
  fetchClubDetail,
  fetchClubGameModes,
  fetchClubPage,
  fetchCompanionPage,
  fetchGameCategories,
  fetchGames,
  fetchPriceList,
} from "@/features/home/api/home.api";
import type {
  ClubFilters,
  CompanionFilters,
  HomeTab,
} from "@/features/home/api/home.types";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

export function useHomeBanners(tab: HomeTab, focused = true) {
  return useQuery({
    queryKey: ["home-banner-slots"],
    queryFn: ({ signal }) => fetchBanners(signal),
    enabled: tab === "home" && focused,
  });
}

export function useHomeGames(active = true) {
  return useQuery({
    queryKey: ["home-games"],
    queryFn: ({ signal }) => fetchGames(signal),
    enabled: active,
  });
}

export function useHomeGameCategories(active = true) {
  return useQuery({
    queryKey: ["home-game-categories"],
    queryFn: ({ signal }) => fetchGameCategories(signal),
    enabled: active,
  });
}

export function useHomeClubs(tab: HomeTab, filters: ClubFilters, focused = true) {
  return useInfiniteQuery({
    // queryKey 不含 tab：切到其他顶部频道（enabled 变 false）时，隐藏中的首页列表数据保持在缓存中不塌缩；切回时 stale 查询自动后台重拉
    // 数据结构新增人数统计，使用新缓存键避免热刷新沿用旧数据触发兼容查询。
    queryKey: ["home-clubs", "companion-counts-v1", filters],
    enabled: tab === "home" && focused,
    staleTime: 30_000,
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      fetchClubPage(filters, pageParam, 10, signal),
    getNextPageParam: (last) => (last.hasMore ? last.nextPage : undefined),
  });
}

export function useClubDetail(id?: string) {
  return useQuery({
    queryKey: ["club-detail", id],
    queryFn: ({ signal }) => fetchClubDetail(id as string, signal),
    enabled: Boolean(id),
    staleTime: 30_000,
  });
}

export function useClubGameModes(gameId?: string, clubId?: string) {
  return useQuery({
    queryKey: ["club-game-modes", gameId, clubId],
    queryFn: ({ signal }) =>
      fetchClubGameModes(gameId as string, clubId as string, signal),
    enabled: Boolean(gameId && clubId),
  });
}

export function useClubCompanions(filters: CompanionFilters | null) {
  return useInfiniteQuery({
    queryKey: ["club-companions", filters],
    queryFn: ({ pageParam, signal }) =>
      fetchCompanionPage(filters as CompanionFilters, pageParam, 20, signal),
    enabled: Boolean(filters),
    staleTime: 30_000,
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.nextPage : undefined),
  });
}

export function usePriceList(groupId?: string) {
  return useQuery({
    queryKey: ["club-price-list", groupId],
    queryFn: ({ signal }) => fetchPriceList(groupId as string, signal),
    enabled: Boolean(groupId),
  });
}
