import { apiClient } from "@/core/network/api-client";
import type { Club, ClubPage } from "@/features/home/api/home.types";

type ApiEnvelope<T> = { code?: string; info?: string; data?: T };
type ApiClubPage = { page?: number; totalPages?: number; records?: ApiClub[] };
type ApiClub = { id: number | string; clubName?: string; logoUrl?: string; intro?: string; followCount?: number; memberCount?: number };
export type SearchUser = { profileId: number; clubId: number; userId: number; clubName?: string; nickname: string; headImage?: string; signature?: string; sex?: number };
type ApiUser = Partial<SearchUser> & { profileId: number; userId?: number; nickname?: string };

export async function searchClubs(keyword: string, page = 1, pageSize = 20): Promise<ClubPage> {
  const response = await apiClient<ApiEnvelope<ApiClubPage>>(
    `/client/v1/club/public/search?keyword=${encodeURIComponent(keyword)}&page=${page}&pageSize=${pageSize}`,
  );
  if (response.code !== "SUCCESS" || !response.data) throw new Error(response.info || "俱乐部搜索失败");
  return {
    items: (response.data.records ?? []).map((club): Club => ({
      id: String(club.id),
      name: club.clubName || "未命名俱乐部",
      description: club.intro || "暂无俱乐部简介",
      coverUrl: club.logoUrl,
      onlineCount: club.followCount ?? 0,
      memberCount: club.memberCount ?? 0,
      clubCode: String(club.id),
      isSelfOperated: club.clubName?.includes("自营") ?? false,
    })),
    hasMore: (response.data.page ?? page) < (response.data.totalPages ?? page),
    nextPage: page + 1,
  };
}

export async function searchUsers(keyword: string, page = 1, pageSize = 20) {
  const response = await apiClient<ApiEnvelope<{ page?: number; totalPages?: number; records?: ApiUser[] }>>(
    `/client/v1/companion/public/search?keyword=${encodeURIComponent(keyword)}&page=${page}&pageSize=${pageSize}`,
  );
  if (response.code !== "SUCCESS" || !response.data) throw new Error(response.info || "用户搜索失败");
  return {
    items: (response.data.records ?? []).map((user): SearchUser => ({
      profileId: user.profileId,
      clubId: Number(user.clubId ?? 0),
      userId: Number(user.userId ?? user.profileId),
      clubName: user.clubName,
      nickname: user.nickname || "未命名用户",
      headImage: user.headImage,
      signature: user.signature,
      sex: user.sex,
    })),
    hasMore: (response.data.page ?? page) < (response.data.totalPages ?? page),
    nextPage: page + 1,
  };
}
