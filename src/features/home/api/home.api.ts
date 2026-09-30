import { apiClient } from '@/core/network/api-client';
import { demoBanners } from "./home.mock";
import type { Banner, ClubDetail, ClubDetailGame, ClubGameMode, ClubPage, CompanionFilters, CompanionPage, Game, GameKey, HomeTab, PriceListTab } from "./home.types";

export type { Banner, Club, ClubPage, Game, GameKey, HomeTab } from "./home.types";

export async function fetchBanners(_tab: HomeTab): Promise<Banner[]> {
  return demoBanners;
}

type ApiEnvelope<T> = { success?: boolean; code?: string; info?: string; data?: T };
type ApiGame = { id: number | string; gameName?: string; iconUrl?: string; backgroundUrl?: string; gameCategory?: number };
type ApiClub = { id: number | string; clubName?: string; logoUrl?: string; intro?: string; followCount?: number; memberCount?: number };
type ApiClubPage = { page?: number; totalPages?: number; total?: number; records?: ApiClub[] };
type ApiClubDetail = {
  id: number | string;
  clubName?: string;
  logoUrl?: string;
  memberCount?: number;
  followCount?: number;
  intro?: string;
  pageConfigGroupId?: string;
  clubGames?: { id: number; clubId: number; gameId: number; gameName?: string; iconUrl?: string; backgroundUrl?: string; gameCategory?: number; status?: number }[];
};
type ApiMode = { id: number; clubId?: number; gameId?: number; modeName?: string; status?: number };
type ApiCompanion = { profileId: number; userId?: number; nickname?: string; headImage?: string; sex?: number; signature?: string; voiceDurationSeconds?: number; orderCount?: number; onlineStatus?: number; gameStatus?: number; price?: number };
type ApiCompanionPage = { page?: number; totalPages?: number; records?: ApiCompanion[] };
type ApiPriceConfig = { linkName?: string; groupId?: string; tabs?: { menuTitle?: string; imageUrl?: string; sortNo?: number }[] };
type ApiResponse<T> = ApiEnvelope<T>;

function requireSuccess<T>(response: ApiResponse<T>, fallback: string): T {
  if (response.code !== "SUCCESS" || response.data === undefined) throw new Error(response.info || fallback);
  return response.data;
}

export async function fetchClubDetail(id: string): Promise<ClubDetail> {
  const response = await apiClient<ApiResponse<ApiClubDetail>>(`/client/v1/club/public/detail?id=${encodeURIComponent(id)}`);
  const data = requireSuccess(response, "俱乐部详情加载失败");
  return {
    id: String(data.id), name: data.clubName || "未命名俱乐部", logoUrl: data.logoUrl,
    intro: data.intro || "暂无俱乐部简介", memberCount: data.memberCount ?? 0, followCount: data.followCount ?? 0,
    pageConfigGroupId: data.pageConfigGroupId,
    games: (data.clubGames ?? []).filter((item) => item.status !== 0).map((item): ClubDetailGame => ({
      id: item.gameId, name: item.gameName || "未命名游戏", iconUrl: item.iconUrl, backgroundUrl: item.backgroundUrl,
      category: item.gameCategory, clubGameId: item.id, clubId: item.clubId, status: item.status ?? 1,
    })),
  };
}

export async function fetchClubGameModes(gameId: string): Promise<ClubGameMode[]> {
  const response = await apiClient<ApiResponse<ApiMode[]>>(`/client/v1/club/public/getGameModeList?id=${encodeURIComponent(gameId)}`);
  return requireSuccess(response, "游戏模式加载失败").filter((item) => item.status !== 0).map((item) => ({ id: item.id, gameId: item.gameId ?? Number(gameId), modeName: item.modeName || `模式${item.id}` }));
}

export async function fetchPriceList(groupId: string): Promise<PriceListTab[]> {
  const response = await apiClient<ApiResponse<ApiPriceConfig>>(`/client/v1/clubPageConfig/public/detail?groupId=${encodeURIComponent(groupId)}`);
  const data = requireSuccess(response, "价目表加载失败");
  return (data.tabs ?? [])
    .filter((tab) => Boolean(tab.imageUrl))
    .sort((a, b) => (a.sortNo ?? 0) - (b.sortNo ?? 0))
    .map((tab, index) => ({ menuTitle: tab.menuTitle || `分类${index + 1}`, imageUrl: tab.imageUrl as string, sortNo: tab.sortNo ?? index }));
}

export async function fetchCompanionPage(filters: CompanionFilters, page = 1, pageSize = 50): Promise<CompanionPage> {
  const response = await apiClient<ApiResponse<ApiCompanionPage>>("/client/v1/companion/public/page", {
    method: "POST", body: { page, pageSize, action: { ...filters, clubId: Number(filters.clubId), gameId: Number(filters.gameId) } },
  });
  const data = requireSuccess(response, "陪玩列表加载失败");
  return { items: (data.records ?? []).map((item) => ({ profileId: item.profileId, userId: item.userId ?? item.profileId, nickname: item.nickname || "未命名陪玩", headImage: item.headImage, sex: item.sex, signature: item.signature, voiceDurationSeconds: item.voiceDurationSeconds, orderCount: item.orderCount ?? 0, onlineStatus: item.onlineStatus ?? 0, gameStatus: item.gameStatus ?? 0, price: item.price ?? 0 })), hasMore: (data.page ?? page) < (data.totalPages ?? page), nextPage: page + 1 };
}

export async function fetchGames(): Promise<Game[]> {
  const response = await apiClient<ApiEnvelope<ApiGame[]>>('/client/v1/game/public/games');
  if (response.code !== 'SUCCESS' || !Array.isArray(response.data)) return [];
  return response.data.map((game) => ({
    id: Number(game.id),
    name: game.gameName || '未命名游戏',
    iconUrl: game.iconUrl,
    backgroundUrl: game.backgroundUrl,
    category: game.gameCategory,
  }));
}

export async function fetchClubPage(game: GameKey, page: number, pageSize = 10): Promise<ClubPage> {
  const response = await apiClient<ApiEnvelope<ApiClubPage>>('/client/v1/club/public/recommend', {
    method: 'POST',
    body: { page, pageSize, action: { gameId: Number(game) } },
  });
  const data = response.data;
  const records = data?.records ?? [];
  return {
    items: records.map((club) => ({
      id: String(club.id),
      name: club.clubName || '未命名俱乐部',
      description: club.intro || '暂无俱乐部简介',
      coverUrl: club.logoUrl,
      onlineCount: club.followCount ?? 0,
      memberCount: club.memberCount ?? 0,
      clubCode: String(club.id),
      isSelfOperated: club.clubName?.includes('自营') ?? false,
    })),
    hasMore: (data?.page ?? page) < (data?.totalPages ?? page),
    nextPage: page + 1,
  };
}
