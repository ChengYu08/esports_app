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
    queryFn: () => fetchProfileDetail(params as ProfileRouteParams),
    enabled: Boolean(params),
  });
}

export function useProfileGameDetail(params: ProfileGameRouteParams | null) {
  return useQuery({
    queryKey: ["profile-game-detail", params?.clubId, params?.userId, params?.gameId],
    queryFn: () => fetchProfileGameDetail(params as ProfileGameRouteParams),
    enabled: Boolean(params),
  });
}

export function useProfileReviews(params: { gameId: string; companionUserId: string } | null) {
  return useQuery({
    queryKey: ["profile-reviews", params?.gameId, params?.companionUserId],
    queryFn: () => fetchProfileReviews(params as { gameId: string; companionUserId: string }),
    enabled: Boolean(params),
  });
}
