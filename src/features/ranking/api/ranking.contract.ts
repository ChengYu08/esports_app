import type { Game } from "../../home/api/home.types";
import type { MyRanking, RankingFilters, RankingItem } from "./ranking.types";

type Envelope<T> = { code?: string; info?: string; data?: T };
type Requester = <T>(path: string, options?: { token?: string }) => Promise<Envelope<T>>;
type ApiItem = Omit<RankingItem, "userId" | "clubId" | "metricValue" | "distanceToPrev"> & {
  userId: number | string;
  clubId: number | string | null;
  metricValue: number | string;
  distanceToPrev: number | string | null;
};
type ApiMyRanking = Omit<MyRanking, "metricValue"> & { metricValue: number | string };
type ApiGame = { id: number | string; gameName?: string; iconUrl?: string; backgroundUrl?: string; gameCategory?: number };

function requireSuccess<T>(response: Envelope<T> | null, fallback: string): T {
  if (response?.code !== "SUCCESS" || response.data === undefined) {
    throw new Error(response?.info || fallback);
  }
  return response.data;
}

export function getRankingParams(filters: RankingFilters): RankingFilters {
  // The GOD board never has a game dimension, even after switching from another board.
  return { ...filters, gameId: filters.boardCode === "GOD" ? "0" : filters.gameId };
}

function queryString(filters: RankingFilters) {
  const params = getRankingParams(filters);
  return `boardCode=${params.boardCode}&rankType=${params.rankType}&gameId=${encodeURIComponent(params.gameId)}`;
}

export function getRankingProfileParams(item: RankingItem) {
  if (!item.clubId || Number(item.clubId) <= 0 || Number(item.userId) <= 0) return null;
  return { userId: item.userId, clubId: item.clubId };
}

export function createRankingContract(request: Requester) {
  return {
    async fetchTop(filters: RankingFilters): Promise<RankingItem[]> {
      const data = requireSuccess(
        await request<ApiItem[] | null>(`/client/v1/rank/top?${queryString(filters)}`),
        "榜单加载失败，请重试",
      );
      return (data ?? []).map((item) => ({
        ...item,
        userId: String(item.userId),
        nickname: item.nickname || "未命名用户",
        clubId: item.clubId == null ? null : String(item.clubId),
        clubName: item.clubName || null,
        metricValue: Number(item.metricValue),
        distanceToPrev: item.distanceToPrev == null ? null : Number(item.distanceToPrev),
      }));
    },
    async fetchMyRank(filters: RankingFilters, token: string): Promise<MyRanking> {
      if (!token) throw new Error("请先登录");
      const data = requireSuccess(
        await request<ApiMyRanking | null>(`/client/v1/rank/myRank?${queryString(filters)}`, { token }),
        "我的排名加载失败，请重试",
      );
      return {
        visible: data?.visible === true,
        rankNo: data?.rankNo ?? null,
        metricValue: Number(data?.metricValue ?? 0),
      };
    },
    async fetchGames(): Promise<Game[]> {
      const data = requireSuccess(
        await request<ApiGame[] | null>("/client/v1/game/public/games"),
        "游戏筛选加载失败，请重试",
      );
      return (data ?? []).map((game) => ({
        id: Number(game.id),
        name: game.gameName || "未命名游戏",
        iconUrl: game.iconUrl,
        backgroundUrl: game.backgroundUrl,
        category: game.gameCategory,
      }));
    },
  };
}
