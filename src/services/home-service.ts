import { env } from '@/lib/env';
import { apiClient } from '@/services/api-client';

export type GameKey = 'pc' | 'mobile';

export type Banner = {
  id: string;
  imageUrl?: string;
  title?: string;
  subtitle?: string;
};

export type Club = {
  id: string;
  name: string;
  description: string;
  coverUrl?: string;
  onlineCount: number;
  memberCount: number;
  clubCode: string;
  isSelfOperated?: boolean;
};

export type ClubPage = {
  items: Club[];
  hasMore: boolean;
  nextPage: number;
};

const demoClubs: Record<GameKey, Club[]> = {
  pc: [
    { id: 'pc-1', name: '盼之电竞自营俱乐部', description: '清一色暖男声线，情绪价值拉满，你的日常陪伴', onlineCount: 21, memberCount: 62, clubCode: '2338820', isSelfOperated: true },
    { id: 'pc-2', name: 'YC电子陪玩俱乐部', description: '清一色暖男声线，情绪价值拉满，你的日常陪伴', onlineCount: 21, memberCount: 62, clubCode: '2338820' },
    { id: 'pc-3', name: '二次元萌妹俱乐部', description: '清一色暖男声线，情绪价值拉满，你的日常陪伴', onlineCount: 21, memberCount: 62, clubCode: '2338820' },
    { id: 'pc-4', name: '三角洲陪玩俱乐部', description: '清一色暖男声线，情绪价值拉满，你的日常陪伴', onlineCount: 21, memberCount: 62, clubCode: '2338820' },
  ],
  mobile: [
    { id: 'mobile-1', name: '三角洲手游自营俱乐部', description: '三角洲手游高质量陪玩，随时组队开黑', onlineCount: 18, memberCount: 48, clubCode: '2338831', isSelfOperated: true },
    { id: 'mobile-2', name: '手游王牌陪玩俱乐部', description: '技术在线，耐心陪伴，快速匹配合适队友', onlineCount: 16, memberCount: 54, clubCode: '2338832' },
    { id: 'mobile-3', name: '甜妹开黑俱乐部', description: '轻松开黑不尴尬，欢乐陪伴每一局', onlineCount: 12, memberCount: 39, clubCode: '2338833' },
  ],
};

export async function fetchBanners(_tab: 'home' | 'court'): Promise<Banner[]> {
  if (env.apiBaseUrl === 'https://api.example.com') {
    return [{ id: 'demo-banner', title: '分享助攻商品', subtitle: '第5元限免' }];
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
