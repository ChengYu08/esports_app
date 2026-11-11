import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { fetchMyCirclePage, fetchUserCirclePage } from "@/features/circle/circle.api";
import {
  fetchProfileDetail,
  fetchProfileGameDetail,
  fetchProfileReviews,
} from "@/features/mine/api/profile.api";
import type { ProfileGameRouteParams, ProfileRouteParams } from "@/features/mine/api/profile.types";

export function useProfileDetail(params: ProfileRouteParams | null, active = true) {
  return useQuery({
    queryKey: ["profile-detail", params?.clubId, params?.userId],
    queryFn: ({ signal }) => fetchProfileDetail(params as ProfileRouteParams, signal),
    enabled: active && Boolean(params),
  });
}

export function useProfileGameDetail(params: ProfileGameRouteParams | null, active = true) {
  return useQuery({
    queryKey: ["profile-game-detail", params?.clubId, params?.userId, params?.gameId],
    queryFn: ({ signal }) => fetchProfileGameDetail(params as ProfileGameRouteParams, signal),
    enabled: active && Boolean(params),
    // 切换游戏时保留上一个游戏的数据做过渡，避免技能区整块闪空；
    // 调用方用 isPlaceholderData 识别占位态并降透明度+禁用下单
    placeholderData: keepPreviousData,
  });
}

export function useProfileReviews(params: { companionUserId: string } | null, active = true) {
  return useQuery({
    queryKey: ["profile-reviews", params?.companionUserId],
    queryFn: ({ signal }) => fetchProfileReviews(params as { companionUserId: string; signal?: AbortSignal }),
    enabled: active && Boolean(params),
  });
}

const CIRCLE_PAGE_SIZE = 10;

export function useProfileCirclePosts(params: {
  userId: string;
  isMine: boolean;
  token?: string;
} | null, active = true) {
  return useInfiniteQuery({
    queryKey: ["profile-circle", params?.userId, params?.isMine],
    queryFn: ({ pageParam, signal }) => {
      const page = pageParam as number;
      if (!params) {
        return Promise.reject(new Error("params required"));
      }
      if (params.isMine && params.token) {
        return fetchMyCirclePage({ page, pageSize: CIRCLE_PAGE_SIZE, token: params.token, signal });
      }
      return fetchUserCirclePage({ userId: params.userId, page, pageSize: CIRCLE_PAGE_SIZE, token: params?.token, signal });
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      if (!lastPage.hasMore) {
        return undefined;
      }
      return (lastPageParam as number) + 1;
    },
    enabled: active && Boolean(params),
  });
}
