import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@esports/auth";
import { useIsFocused } from "expo-router";

import type { ProfileDetail } from "@/features/mine/api/profile.types";
import {
  fetchUserFollowCount,
  fetchUserFollowPage,
  fetchUserFollowState,
  followUser,
  unfollowUser,
  type UserFollowCount,
  type UserFollowType,
} from "@/features/mine/api/user-follow.api";

const PAGE_SIZE = 20;

export function userFollowStateQueryKey(
  followUserId?: string,
  viewerUserId?: string,
) {
  return ["user-follow-state", followUserId, viewerUserId] as const;
}

export function userFollowCountQueryKey(userId?: string) {
  return ["user-follow-count", userId] as const;
}

export function useUserFollowCount(userId?: string) {
  const token = useAuthStore((state) => state.accessToken);

  return useQuery({
    queryKey: userFollowCountQueryKey(userId),
    queryFn: ({ signal }) => fetchUserFollowCount(userId as string, token ?? undefined, signal),
    enabled: Boolean(userId),
  });
}

export function useUserFollowState(followUserId?: string, active = true) {
  const token = useAuthStore((state) => state.accessToken);
  const viewerUserId = useAuthStore((state) => state.user?.id);

  return useQuery({
    queryKey: userFollowStateQueryKey(followUserId, viewerUserId),
    queryFn: ({ signal }) => fetchUserFollowState(followUserId as string, token as string, signal),
    enabled: active && Boolean(followUserId && token),
  });
}

export function useUserFollowPage(userId: string | undefined, type: UserFollowType) {
  const focused = useIsFocused();
  const token = useAuthStore((state) => state.accessToken);
  const viewerUserId = useAuthStore((state) => state.user?.id);

  return useInfiniteQuery({
    queryKey: [
      "user-follow-page",
      userId,
      type,
      viewerUserId,
      Boolean(token),
    ] as const,
    queryFn: ({ pageParam, signal }) =>
      fetchUserFollowPage({
        userId: userId as string,
        type,
        page: pageParam,
        pageSize: PAGE_SIZE,
        token: token ?? undefined,
        signal,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.page + 1 : undefined,
    // 路由堆栈下方仍保持挂载：失焦期间禁用查询，避免失效重拉把
    // 离屏 RefreshControl 置为 refreshing（iOS 会卡死不消失），恢复焦点后再按失效标记重拉
    enabled: Boolean(userId) && focused,
  });
}

export function useToggleUserFollow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      followUserId: string;
      currentlyFollowed: boolean;
      token: string;
      viewerUserId: string;
    }) =>
      params.currentlyFollowed
        ? unfollowUser(params.followUserId, params.token)
        : followUser(params.followUserId, params.token),
    onSuccess: (state, params) => {
      queryClient.setQueryData(
        userFollowStateQueryKey(params.followUserId, params.viewerUserId),
        state,
      );
      queryClient.setQueryData<UserFollowCount>(
        userFollowCountQueryKey(params.followUserId),
        (count) =>
          count ? { ...count, fansCount: state.fansCount } : count,
      );
      queryClient.setQueryData<UserFollowCount>(
        userFollowCountQueryKey(params.viewerUserId),
        (count) =>
          count ? { ...count, followCount: state.followCount } : count,
      );
      queryClient.setQueriesData<ProfileDetail>(
        { queryKey: ["profile-detail"] },
        (profile) => {
          if (!profile) return profile;
          const isFollowTarget = String(profile.userId) === params.followUserId;
          const isViewer = String(profile.userId) === params.viewerUserId;
          if (!isFollowTarget && !isViewer) return profile;
          return {
            ...profile,
            ...(isFollowTarget ? { fansCount: state.fansCount } : {}),
            ...(isViewer ? { followCount: state.followCount } : {}),
          };
        },
      );
      // 关注/粉丝列表强依赖关注状态（取关需移出行、回关需回显），
      // 且全局 staleTime 30s 会挡住 tab 切换/返回时的自然重拉，必须显式失效
      void queryClient.invalidateQueries({ queryKey: ["user-follow-page"] });
    },
  });
}
