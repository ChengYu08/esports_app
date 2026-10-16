import { useQuery } from "@tanstack/react-query";

import {
  fetchProfileDetail,
  fetchProfileGameDetail,
  fetchProfileReviews,
} from "@/features/mine/api/profile.api";
import type { ProfileGameRouteParams, ProfileRouteParams } from "@/features/mine/api/profile.types";

export function useProfileDetail(params: ProfileRouteParams | null) {
  return useQuery({
    queryKey: ["profile-detail", params?.clubId, params?.userId],
    queryFn: ({ signal }) => fetchProfileDetail(params as ProfileRouteParams, signal),
    enabled: Boolean(params),
  });
}

export function useProfileGameDetail(params: ProfileGameRouteParams | null) {
  return useQuery({
    queryKey: ["profile-game-detail", params?.clubId, params?.userId, params?.gameId],
    queryFn: ({ signal }) => fetchProfileGameDetail(params as ProfileGameRouteParams, signal),
    enabled: Boolean(params),
  });
}

export function useProfileReviews(params: { gameId: string; companionUserId: string } | null) {
  return useQuery({
    queryKey: ["profile-reviews", params?.gameId, params?.companionUserId],
    queryFn: ({ signal }) => fetchProfileReviews(params as { gameId: string; companionUserId: string; signal?: AbortSignal }),
    enabled: Boolean(params),
  });
}
