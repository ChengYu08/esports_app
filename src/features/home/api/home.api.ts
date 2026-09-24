import { env } from '@/core/config/env';
import { apiClient } from '@/core/network/api-client';
import { demoBanners, demoClubs } from "./home.mock";
import type { Banner, ClubPage, GameKey, HomeTab } from "./home.types";

export type { Banner, Club, ClubPage, GameKey, HomeTab } from "./home.types";

export async function fetchBanners(_tab: HomeTab): Promise<Banner[]> {
  if (env.apiBaseUrl === 'https://api.example.com') {
    return demoBanners;
  }
  return apiClient<Banner[]>('/home/banners');
}

export async function fetchClubPage(game: GameKey, page: number, pageSize = 10): Promise<ClubPage> {
  if (env.apiBaseUrl === 'https://api.example.com') {
    const source = demoClubs[game];
    const start = (page - 1) * pageSize;
    const items = source.slice(start, start + pageSize);
    return { items, hasMore: start + pageSize < source.length, nextPage: page + 1 };
  }
  return apiClient<ClubPage>(`/home/clubs?game=${game}&page=${page}&pageSize=${pageSize}`);
}
