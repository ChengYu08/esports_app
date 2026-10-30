import { apiClient } from '@/core/network/api-client';
import { HOME_BANNER_SLOT_CODES } from "../home-banner.contract";
import type { ClubDetail, ClubDetailGame, ClubFilters, ClubGameMode, ClubPage, CompanionFilters, CompanionPage, Game, GameCategory, HomeBannerSlot, PriceListTab } from "./home.types";

export type { Banner, Club, ClubPage, Game, GameKey, HomeTab } from "./home.types";

type ApiBanner = {
  deliveryId: number | string;
  materialId: number | string;
  materialName?: string | null;
  displayImageUrl?: string | null;
  contentImageUrl?: string | null;
  linkUrl?: string | null;
  sort?: number | null;
};

type ApiBannerSlot = {
  slotCode: string;
  slotName?: string;
  displayMode: HomeBannerSlot["displayMode"];
  intervalSec?: number | null;
  items?: ApiBanner[] | null;
};

export async function fetchBanners(signal?: AbortSignal): Promise<HomeBannerSlot[]> {
  const response = await apiClient<ApiEnvelope<ApiBannerSlot[] | null>>("/client/v1/ad/slot/list", {
    method: "POST",
    body: { slotCodes: HOME_BANNER_SLOT_CODES },
    signal,
  });
  if (response.code !== "SUCCESS") {
    throw new Error(response.info || "首页活动加载失败");
  }
  // 固定 App 楼层顺序，不依赖接口返回资源位的排列，也不混入 PC 端素材。
  return HOME_BANNER_SLOT_CODES.flatMap((code) => {
    const slot = response.data?.find((item) => item.slotCode === code);
    if (!slot) {
      return [];
    }
    return [{
      code,
      name: slot.slotName || "首页活动",
      displayMode: slot.displayMode,
      intervalMs: typeof slot.intervalSec === "number" && Number.isFinite(slot.intervalSec) && slot.intervalSec > 0
        ? slot.intervalSec * 1000
        : 5000,
      items: [...(slot.items ?? [])]
        .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
        .flatMap((banner) => {
          const imageUrl = banner.displayImageUrl?.trim();
          if (!imageUrl) {
            return [];
          }
          return [{
            id: `${banner.deliveryId}-${banner.materialId}`,
            imageUrl,
            title: banner.materialName?.trim() || undefined,
            contentImageUrl: banner.contentImageUrl?.trim() || undefined,
            linkUrl: banner.linkUrl?.trim() || undefined,
          }];
        }),
    }];
  });
}

type ApiEnvelope<T> = { success?: boolean; code?: string; info?: string; data?: T };
type ApiGame = { id: number | string; gameName?: string; iconUrl?: string; backgroundUrl?: string; gameCategory?: number; gameCategoryId?: number | string };
type ApiGameCategory = { id: number | string; name: string; iconUrl?: string | null };
type ApiClub = {
  id: number | string;
  clubName?: string;
  clubTag?: string | null;
  logoUrl?: string;
  intro?: string;
  followCount?: number;
  memberCount?: number;
  onlineCount?: number;
  orderNoticeUrl?: string;
  clubGames?: { gameId: number; gameName?: string; iconUrl?: string; status?: number }[];
};
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
type ApiCompanionPage = { page?: number; totalPages?: number; records?: ApiCompanion[] };
type ApiPriceConfig = { linkName?: string; groupId?: string; tabs?: { menuTitle?: string; imageUrl?: string; sortNo?: number }[] };
type ApiResponse<T> = ApiEnvelope<T>;

function requireSuccess<T>(response: ApiResponse<T>, fallback: string): T {
  if (response.code !== "SUCCESS" || response.data === undefined) throw new Error(response.info || fallback);
  return response.data;
}

export async function fetchClubDetail(id: string, signal?: AbortSignal): Promise<ClubDetail> {
  const response = await apiClient<ApiResponse<ApiClubDetail>>(`/client/v1/club/public/detail?id=${encodeURIComponent(id)}`, { signal });
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

export async function fetchClubGameModes(gameId: string, signal?: AbortSignal): Promise<ClubGameMode[]> {
  const response = await apiClient<ApiResponse<ApiMode[]>>(`/client/v1/club/public/getGameModeList?id=${encodeURIComponent(gameId)}`, { signal });
  return requireSuccess(response, "游戏模式加载失败").filter((item) => item.status !== 0).map((item) => ({ id: item.id, gameId: item.gameId ?? Number(gameId), modeName: item.modeName || `模式${item.id}` }));
}

export async function fetchPriceList(groupId: string, signal?: AbortSignal): Promise<PriceListTab[]> {
  const response = await apiClient<ApiResponse<ApiPriceConfig>>(`/client/v1/clubPageConfig/public/detail?groupId=${encodeURIComponent(groupId)}`, { signal });
  const data = requireSuccess(response, "价目表加载失败");
  return (data.tabs ?? [])
    .filter((tab) => Boolean(tab.imageUrl))
    .sort((a, b) => (a.sortNo ?? 0) - (b.sortNo ?? 0))
    .map((tab, index) => ({ menuTitle: tab.menuTitle || `分类${index + 1}`, imageUrl: tab.imageUrl as string, sortNo: tab.sortNo ?? index }));
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
      memberCount: club.memberCount ?? 0,
      clubCode: String(club.id),
      isSelfOperated: club.clubName?.includes('自营') ?? false,
      clubTag: club.clubTag || undefined,
      // 列表接口已带 clubGames（游戏图标），卡片上展示主打游戏。
      games: (club.clubGames ?? [])
        .filter((item) => item.status !== 0 && item.iconUrl)
        .map((item) => ({
          id: item.gameId,
          name: item.gameName || "未命名游戏",
          iconUrl: item.iconUrl as string,
        })),
    })),
    hasMore: (data?.page ?? page) < (data?.totalPages ?? page),
    nextPage: page + 1,
  };
}
