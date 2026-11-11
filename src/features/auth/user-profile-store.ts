import { create } from 'zustand';

import { clientAuthApi, type ClientUserProfile } from './client-auth.api';

/** 缓存有效期：到期视为缺失重拉（不做主动失效，改名/换头像的陈旧窗口以 5 分钟为限） */
const PROFILE_TTL_MS = 5 * 60 * 1000;
/** 批量接口分片上限，对齐融云/后端单次查询容量 */
const BATCH_CHUNK = 50;

export type CachedUserProfile = {
  id: string;
  nickname: string;
  headImage: string;
  fetchedAt: number;
};

type UserProfileState = {
  byId: Record<string, CachedUserProfile>;
  inflightIds: string[];
  getCached: (id: string) => CachedUserProfile | undefined;
  splitByCache: (ids: string[]) => { cached: CachedUserProfile[]; missing: string[] };
  setProfiles: (profiles: ClientUserProfile[]) => void;
  isFetching: (id: string) => boolean;
  /** 拉取缺失资料并写缓存；返回本轮新拉到的条目（失败不缓存，下轮自然重试） */
  hydrateProfiles: (ids: string[], token: string) => Promise<CachedUserProfile[]>;
  reset: () => void;
};

const isFresh = (profile: CachedUserProfile | undefined) =>
  profile != null && Date.now() - profile.fetchedAt < PROFILE_TTL_MS;

const dedupe = (ids: string[]) => Array.from(new Set(ids.filter(Boolean)));

export const useUserProfileStore = create<UserProfileState>((set, get) => ({
  byId: {},
  inflightIds: [],
  getCached: (id) => {
    const profile = get().byId[id];
    return profile && isFresh(profile) ? profile : undefined;
  },
  splitByCache: (ids) => {
    const byId = get().byId;
    const cached: CachedUserProfile[] = [];
    const missing: string[] = [];
    for (const id of dedupe(ids)) {
      const profile = byId[id];
      if (profile && isFresh(profile)) cached.push(profile);
      else missing.push(id);
    }
    return { cached, missing };
  },
  setProfiles: (profiles) => set((state) => {
    const byId = { ...state.byId };
    const fetchedAt = Date.now();
    for (const profile of profiles) {
      byId[profile.id] = {
        id: profile.id,
        nickname: profile.nickname,
        headImage: profile.headImage,
        fetchedAt,
      };
    }
    return { byId };
  }),
  isFetching: (id) => get().inflightIds.includes(id),
  hydrateProfiles: async (ids, token) => {
    const { byId, inflightIds } = get();
    const inflight = new Set(inflightIds);
    const missing = dedupe(ids).filter(
      (id) => !inflight.has(id) && !isFresh(byId[id]),
    );
    if (missing.length === 0 || !token) return [];
    set({ inflightIds: [...get().inflightIds, ...missing] });
    try {
      const chunks: string[][] = [];
      for (let index = 0; index < missing.length; index += BATCH_CHUNK) {
        chunks.push(missing.slice(index, index + BATCH_CHUNK));
      }
      const settled = await Promise.all(
        chunks.map((chunk) => clientAuthApi.getUserProfiles(token, chunk).catch(() => null)),
      );
      const fetched: CachedUserProfile[] = [];
      for (const profiles of settled) {
        if (!profiles) continue;
        get().setProfiles(profiles);
        for (const profile of profiles) {
          fetched.push(get().byId[profile.id]);
        }
      }
      return fetched;
    } finally {
      const remaining = new Set(missing);
      set({ inflightIds: get().inflightIds.filter((id) => !remaining.has(id)) });
    }
  },
  reset: () => set({ byId: {}, inflightIds: [] }),
}));
