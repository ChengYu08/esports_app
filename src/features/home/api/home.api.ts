import { apiClient } from '@/core/network/api-client';
import { APP_HOME_POPUP_SLOT_CODE, HOME_BANNER_SLOT_CODES } from "../home-banner.contract";
import type { Banner, ClubDetail, ClubDetailGame, ClubFilters, ClubGameMode, ClubPage, CompanionFilters, CompanionPage, Game, GameCategory, HomeBannerSlot, HomePopupContent, PriceListTab } from "./home.types";

export type { Banner, Club, ClubPage, Game, GameKey, HomeTab } from "./home.types";

type ApiBanner = {
  deliveryId: number | string;
  materialId: number | string;
  materialName?: string | null;
  displayImageUrl?: string | null;
  contentImageUrl?: string | null;
  linkUrl?: string | null;
  linkConfig?: Record<string, unknown> | null;
  sort?: number | null;
};

type ApiBannerSlot = {
  slotCode: string;
  slotName?: string;
  displayMode: HomeBannerSlot["displayMode"];
  intervalSec?: number | null;
  items?: ApiBanner[] | null;
};

const DEFAULT_BANNER_INTERVAL_MS = 5000;

function resolveIntervalMs(intervalSec?: number | null): number {
  if (typeof intervalSec === "number" && Number.isFinite(intervalSec) && intervalSec > 0) {
    return intervalSec * 1000;
  }
  return DEFAULT_BANNER_INTERVAL_MS;
}

function mapSlotItems(items?: ApiBanner[] | null): Banner[] {
  return [...(items ?? [])]
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
    .flatMap((banner) => {
      const imageUrl = banner.displayImageUrl?.trim();
      if (!imageUrl) {
        return [];
      }
      const linkUrl = banner.linkUrl?.trim();
      return [{
        id: `${banner.deliveryId}-${banner.materialId}`,
        imageUrl,
        title: banner.materialName?.trim() || undefined,
        contentImageUrl: banner.contentImageUrl?.trim() || undefined,
        linkUrl: linkUrl || undefined,
        linkConfig: banner.linkConfig ?? undefined,
      }];
    });
}

async function fetchAdSlots(slotCodes: string[], signal?: AbortSignal): Promise<ApiBannerSlot[]> {
  const response = await apiClient<ApiEnvelope<ApiBannerSlot[] | null>>("/client/v1/ad/slot/list", {
    method: "POST",
    body: { slotCodes },
    signal,
  });
  if (response.code !== "SUCCESS") {
    throw new Error(response.info || "首页活动加载失败");
  }
  return response.data ?? [];
}

export async function fetchBanners(signal?: AbortSignal): Promise<HomeBannerSlot[]> {
  const data = await fetchAdSlots([...HOME_BANNER_SLOT_CODES], signal);
  // 固定 App 楼层顺序，不依赖接口返回资源位的排列，也不混入 PC 端素材。
  return HOME_BANNER_SLOT_CODES.flatMap((code) => {
    const slot = data.find((item) => item.slotCode === code);
    if (!slot) {
      return [];
    }
    return [{
      code,
      name: slot.slotName || "首页活动",
      displayMode: slot.displayMode,
      intervalMs: resolveIntervalMs(slot.intervalSec),
      items: mapSlotItems(slot.items),
    }];
  });
}

/** 拉取首页开屏弹窗素材；无有效展示图时返回 null。 */
export async function fetchHomePopup(signal?: AbortSignal): Promise<HomePopupContent | null> {
  const data = await fetchAdSlots([APP_HOME_POPUP_SLOT_CODE], signal);
  const slot = data.find((item) => item.slotCode === APP_HOME_POPUP_SLOT_CODE);
  if (!slot) {
    return null;
  }
  const items = mapSlotItems(slot.items);
  if (items.length === 0) {
    return null;
  }
  return {
    items,
    intervalMs: resolveIntervalMs(slot.intervalSec),
  };
}

type ApiEnvelope<T> = { success?: boolean; code?: string; info?: string; data?: T };
type ApiGame = { id: number | string; gameName?: string; iconUrl?: string; backgroundUrl?: string; gameCategory?: number; gameCategoryId?: number | string };
type ApiGameCategory = { id: number | string; name: string; iconUrl?: string | null; mobileIconUrl?: string | null; mobile_icon_url?: string | null };
type ApiClub = { clubNo?: string;
  id: number | string;
  clubName?: string;
  clubTag?: string | null;
  clubNature?: "SELF_OPERATED" | "THIRD_PARTY" | null;
  logoUrl?: string;
  intro?: string;
  followCount?: number;
  memberCount?: number;
  onlineCount?: number;
  orderNoticeUrl?: string;
  onlineCompanionCount?: number;
  clubGames?: { gameId: number; gameName?: string; iconUrl?: string; status?: number; companionCount?: number }[];
};
type ApiClubPage = { page?: number; totalPages?: number; total?: number; records?: ApiClub[] };
type ApiClubDetail = { clubNo?: string;
  id: number | string;
  clubName?: string;
  clubTag?: string | null;
  logoUrl?: string;
  memberCount?: number;
  followCount?: number;
  intro?: string;
  pageConfigGroupId?: string;
  clubGames?: { id: number; clubId: number; gameId: number; gameName?: string; iconUrl?: string; backgroundUrl?: string; gameCategory?: number; status?: number }[];
};
type ApiMode = { id: number; clubId?: number; gameId?: number; modeName?: string; status?: number };
export type CompanionTag = { id: number; name: string };

export async function fetchCompanionTags(clubId: string, signal?: AbortSignal): Promise<CompanionTag[]> {
  const response = await apiClient<ApiEnvelope<CompanionTag[]>>(`/client/v1/companion/public/tag/options?clubId=${encodeURIComponent(clubId)}`, { signal });
  return requireSuccess(response, "陪玩标签加载失败");
}
type ApiCompanion = {
  profileId: number;
  userId?: number;
  nickname?: string;
  headImage?: string;
  sex?: number;
  age?: number | string;
  signature?: string;
  voiceUrl?: string;
  voiceDurationSeconds?: number;
  orderCount?: number;
  onlineStatus?: number;
  gameStatus?: number;
  price?: number;
  gameId?: number;
  gameName?: string;
  /** 卡内陪玩标签（明星/魔王pro 等），背景色由后台配置下发 */
  tagId?: number;
  tagName?: string;
  tagIconUrl?: string;
  tagBackgroundColor?: string;
  tagMobileBackgroundColor?: string;
  gameModeId?: number;
  /** 游戏模式，如 大乱斗 */
  modeName?: string;
  gameLevelId?: number;
  /** 游戏等级/段位，如 星耀 */
  levelName?: string;
  clubGameServiceId?: number;
  /** 服务类型，如 陪玩 */
  clubGameServiceName?: string;
  companionServiceId?: number;
};
type ApiCompanionPage = { page?: number; totalPages?: number; total?: number; records?: ApiCompanion[] };
type ApiPriceConfig = { linkName?: string; groupId?: string; tabs?: { menuTitle?: string; imageUrl?: string | null; imageUrls?: (string | null)[] | null; sortNo?: number }[] };
type ApiResponse<T> = ApiEnvelope<T>;

function requireSuccess<T>(response: ApiResponse<T>, fallback: string): T {
  if (response.code !== "SUCCESS" || response.data === undefined) throw new Error(response.info || fallback);
  return response.data;
}

export async function fetchClubDetail(id: string, signal?: AbortSignal): Promise<ClubDetail> {
  const response = await apiClient<ApiResponse<ApiClubDetail>>(`/client/v1/club/public/detail?id=${encodeURIComponent(id)}`, { signal });
  const data = requireSuccess(response, "俱乐部详情加载失败");
  return {
    id: String(data.id), clubCode: data.clubNo ?? String(data.id), name: data.clubName || "未命名俱乐部", clubTag: data.clubTag || undefined, logoUrl: data.logoUrl,
    intro: data.intro || "暂无俱乐部简介", memberCount: data.memberCount ?? 0, followCount: data.followCount ?? 0,
    pageConfigGroupId: data.pageConfigGroupId,
    games: (data.clubGames ?? []).filter((item) => item.status !== 0).map((item): ClubDetailGame => ({
      id: item.gameId, name: item.gameName || "未命名游戏", iconUrl: item.iconUrl, backgroundUrl: item.backgroundUrl,
      category: item.gameCategory, clubGameId: item.id, clubId: item.clubId, status: item.status ?? 1,
    })),
  };
}

export async function fetchClubGameModes(gameId: string, clubId: string, signal?: AbortSignal): Promise<ClubGameMode[]> {
  const response = await apiClient<ApiResponse<ApiMode[]>>(`/client/v1/club/public/getGameModeList?id=${encodeURIComponent(gameId)}`, { signal });
  return requireSuccess(response, "游戏模式加载失败").filter((item) => item.status !== 0 && (item.clubId == null || String(item.clubId) === clubId)).map((item) => ({ id: item.id, gameId: item.gameId ?? Number(gameId), modeName: item.modeName || `模式${item.id}` }));
}

export async function fetchPriceList(groupId: string, signal?: AbortSignal): Promise<PriceListTab[]> {
  const response = await apiClient<ApiResponse<ApiPriceConfig>>(`/client/v1/clubPageConfig/public/detail?groupId=${encodeURIComponent(groupId)}`, { signal });
  // 页面配置被删除/停用时接口返回 FAILED「页面不存在或未开放」，按空价目表降级（与 PC 端一致），不当成加载失败
  if (response.code !== "SUCCESS" || !response.data) return [];
  return (response.data.tabs ?? [])
    .sort((a, b) => (a.sortNo ?? 0) - (b.sortNo ?? 0))
    .map((tab) => {
      const imageUrls = (tab.imageUrls ?? []).map((url) => (url ?? "").trim()).filter(Boolean);
      const singleImage = tab.imageUrl?.trim();
      return { ...tab, imageUrls: imageUrls.length ? imageUrls : singleImage ? [singleImage] : [] };
    })
    .filter((tab) => tab.imageUrls.length > 0)
    .map((tab, index) => ({ menuTitle: tab.menuTitle || `分类${index + 1}`, imageUrls: tab.imageUrls, sortNo: tab.sortNo ?? index }));
}

export async function fetchCompanionPage(filters: CompanionFilters, page = 1, pageSize = 50, signal?: AbortSignal): Promise<CompanionPage> {
  const response = await apiClient<ApiResponse<ApiCompanionPage>>("/client/v1/companion/public/page", {
    method: "POST", body: { page, pageSize, action: { ...filters, clubId: Number(filters.clubId), gameId: Number(filters.gameId) } }, signal,
  });
  const data = requireSuccess(response, "陪玩列表加载失败");
  return {
    items: (data.records ?? []).map((item) => ({
      profileId: item.profileId,
      userId: item.userId ?? item.profileId,
      nickname: item.nickname || "未命名陪玩",
      headImage: item.headImage,
      sex: item.sex,
      age: item.age != null && item.age !== "" ? Number(item.age) : null,
      signature: item.signature || "",
      voiceUrl: item.voiceUrl,
      voiceDurationSeconds: item.voiceDurationSeconds,
      orderCount: item.orderCount ?? 0,
      onlineStatus: item.onlineStatus ?? 0,
      gameStatus: item.gameStatus ?? 0,
      price: item.price ?? 0,
      gameName: item.gameName || "",
      tagName: item.tagName || "",
      tagBackgroundColor: item.tagBackgroundColor || "",
      modeName: item.modeName || "",
      levelName: item.levelName || "",
      serviceName: item.clubGameServiceName || "",
    })),
    hasMore: (data.page ?? page) < (data.totalPages ?? page),
    nextPage: page + 1,
  };
}

export async function fetchGames(signal?: AbortSignal): Promise<Game[]> {
  const response = await apiClient<ApiEnvelope<ApiGame[]>>('/client/v1/game/public/games', { signal });
  return requireSuccess(response, "游戏列表加载失败").map((game) => ({
    id: Number(game.id),
    name: game.gameName || '未命名游戏',
    iconUrl: game.iconUrl,
    backgroundUrl: game.backgroundUrl,
    category: game.gameCategory,
    gameCategoryId: game.gameCategoryId == null ? undefined : String(game.gameCategoryId),
  }));
}

export async function fetchGameCategories(signal?: AbortSignal): Promise<GameCategory[]> {
  const response = await apiClient<ApiEnvelope<ApiGameCategory[]>>("/client/v1/game/public/categories", { signal });
  return requireSuccess(response, "游戏品类加载失败").map((category) => ({
    id: String(category.id),
    name: category.name,
    iconUrl: category.iconUrl ?? undefined,
    mobileIconUrl: category.mobileIconUrl ?? category.mobile_icon_url ?? undefined,
  }));
}

export async function fetchClubPage(filters: ClubFilters, page: number, pageSize = 10, signal?: AbortSignal): Promise<ClubPage> {
  const response = await apiClient<ApiEnvelope<ApiClubPage>>('/client/v1/club/public/page', {
    method: 'POST',
    body: {
      page,
      pageSize,
      action: {
        ...(filters.gameId ? { gameId: Number(filters.gameId) } : {}),
        ...(filters.gameCategoryId ? { gameCategoryId: Number(filters.gameCategoryId) } : {}),
      },
    },
    signal,
  });
  const data = requireSuccess(response, "俱乐部列表加载失败");
  const records = data?.records ?? [];
  return {
    items: records.map((club) => ({
      id: String(club.id),
      name: club.clubName || '未命名俱乐部',
      description: club.intro || '暂无俱乐部简介',
      coverUrl: club.logoUrl,
      onlineCount: club.onlineCount ?? 0,
      onlineCompanionCount: club.onlineCompanionCount,
      memberCount: club.memberCount ?? 0,
      clubCode: club.clubNo ?? String(club.id),
      isSelfOperated: club.clubNature == null
        ? club.clubName?.includes("自营") ?? false
        : club.clubNature === "SELF_OPERATED",
      clubTag: club.clubTag || undefined,
      gameIds: Array.from(new Set((club.clubGames ?? [])
        .filter((item) => item.status !== 0)
        .map((item) => item.gameId))),
      // 列表接口已带 clubGames（游戏图标），卡片上展示主打游戏。
      games: (club.clubGames ?? [])
        .filter((item) => item.status !== 0)
        .map((item) => ({
          id: item.gameId,
          name: item.gameName || "未命名游戏",
          iconUrl: item.iconUrl,
          companionCount: item.companionCount,
        })),
    })),
    hasMore: (data?.page ?? page) < (data?.totalPages ?? page),
    nextPage: page + 1,
  };
}

/** 按游戏统计可展示的陪玩人数，接口总数已按用户去重。 */
export async function fetchClubGameCompanionCounts(clubId: string, gameIds: readonly number[], signal?: AbortSignal): Promise<Record<number, number>> {
  const counts: Record<number, number> = {};
  for (const gameId of new Set(gameIds)) {
    const response = await apiClient<ApiEnvelope<ApiCompanionPage>>("/client/v1/companion/public/page", {
      method: "POST",
      body: { page: 1, pageSize: 1, action: { clubId: Number(clubId), gameId } },
      signal,
    });
    const data = requireSuccess(response, "游戏陪玩人数加载失败");
    if (typeof data.total !== "number" || !Number.isFinite(data.total)) {
      throw new Error("游戏陪玩人数缺失");
    }
    counts[gameId] = data.total;
  }
  return counts;
}

/** 按详情页相同的服务条件查询在线陪玩，跨游戏按用户去重，不统计普通在线成员。 */
export async function fetchClubOnlineCount(clubId: string, gameIds: readonly number[], signal?: AbortSignal): Promise<number> {
  const onlineUsers = new Set<number>();
  // 同一俱乐部的游戏依次查询，避免首页每张卡片同时发起大量请求。
  for (const gameId of new Set(gameIds)) {
    let page = 1;
    let totalPages = 1;
    do {
      const response = await apiClient<ApiEnvelope<ApiCompanionPage>>("/client/v1/companion/public/page", {
        method: "POST",
        body: { page, pageSize: 50, action: { clubId: Number(clubId), gameId, onlineOnly: true } },
        signal,
      });
      const data = requireSuccess(response, "在线陪玩人数加载失败");
      for (const companion of data.records ?? []) {
        if (companion.onlineStatus === 1) {
          onlineUsers.add(companion.userId ?? companion.profileId);
        }
      }
      totalPages = data.totalPages ?? 1;
      page += 1;
    } while (page <= totalPages);
  }
  return onlineUsers.size;
}
