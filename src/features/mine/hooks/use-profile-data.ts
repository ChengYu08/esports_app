import { useQuery } from "@tanstack/react-query";

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
  });
}

export function useProfileReviews(params: { companionUserId: string } | null, active = true) {
  return useQuery({
    queryKey: ["profile-reviews", params?.companionUserId],
    queryFn: ({ signal }) => fetchProfileReviews(params as { companionUserId: string; signal?: AbortSignal }),
    enabled: active && Boolean(params),
  });
}
