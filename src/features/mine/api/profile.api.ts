import { apiClient, type RequestOptions } from "@/core/network/api-client";
import { createProfileContract } from "./profile.contract";
import type { ProfileGameRouteParams, ProfileRouteParams } from "./profile.types";

const request = <T>(path: string, options: { method: "POST"; body: unknown; signal?: AbortSignal }) =>
  apiClient<T>(path, options as RequestOptions);

const profileApi = createProfileContract(request);

export const fetchProfileDetail = (params: ProfileRouteParams, signal?: AbortSignal) => profileApi.fetchProfileDetail(params, signal);
export const fetchProfileGameDetail = (params: ProfileGameRouteParams, signal?: AbortSignal) => profileApi.fetchProfileGameDetail(params, signal);
export const fetchProfileReviews = (params: { gameId: string; companionUserId: string; page?: number; pageSize?: number; signal?: AbortSignal }) =>
  profileApi.fetchProfileReviews(params);
