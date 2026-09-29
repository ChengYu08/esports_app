import { apiClient } from '@/core/network/api-client';
import { demoBanners } from "./home.mock";
import type { Banner, ClubPage, Game, GameKey, HomeTab } from "./home.types";

export type { Banner, Club, ClubPage, Game, GameKey, HomeTab } from "./home.types";

export async function fetchBanners(_tab: HomeTab): Promise<Banner[]> {
  return demoBanners;
}

type ApiEnvelope<T> = { success?: boolean; code?: string; info?: string; data?: T };
type ApiGame = { id: number | string; gameName?: string; iconUrl?: string; backgroundUrl?: string; gameCategory?: number };
type ApiClub = { id: number | string; clubName?: string; logoUrl?: string; intro?: string; followCount?: number; memberCount?: number };
type ApiClubPage = { page?: number; totalPages?: number; total?: number; records?: ApiClub[] };

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
