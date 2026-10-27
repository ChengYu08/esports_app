import { useQuery } from "@tanstack/react-query";
import { fetchProfileDetail } from "@/features/mine/api/profile.api";
import { searchUsers, type SearchUser } from "../api/search.api";

export function useUserSearch(keyword: string) {
  return useQuery({
    queryKey: ["user-search", keyword],
    queryFn: ({ signal }) => searchUsers(keyword, 1, 20, signal),
    enabled: keyword.trim().length > 0,
  });
}

/** Older search responses omit status fields; reuse the cached public profile. */
export function useSearchUserProfile(user: SearchUser) {
  const clubId = user.clubId > 0 ? String(user.clubId) : undefined;
  const userId = String(user.userId);
  return useQuery({
    queryKey: ["profile-detail", clubId, userId],
    queryFn: ({ signal }) => fetchProfileDetail({ clubId, userId }, signal),
    enabled: user.userId > 0 && (user.onlineStatus === undefined || user.gameStatus === undefined),
    staleTime: 30_000,
  });
}
