import { apiClient, type RequestOptions } from "@/core/network/api-client";
import { createProfileContract } from "./profile.contract";
import type { ProfileGameRouteParams, ProfileRouteParams } from "./profile.types";

const request = <T>(path: string, options: { method: "POST"; body: unknown }) =>
  apiClient<T>(path, options as RequestOptions);

const profileApi = createProfileContract(request);

export const fetchProfileDetail = (params: ProfileRouteParams) => profileApi.fetchProfileDetail(params);
export const fetchProfileGameDetail = (params: ProfileGameRouteParams) => profileApi.fetchProfileGameDetail(params);
export const fetchProfileReviews = (params: { gameId: string; companionUserId: string; page?: number; pageSize?: number }) =>
  profileApi.fetchProfileReviews(params);
