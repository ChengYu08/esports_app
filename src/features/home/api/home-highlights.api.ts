import { apiClient } from "@/core/network/api-client";

export type HomeBroadcast = { id: string; avatar: string; nickname: string; amount: number };
export type HomeHighlightPerson = { id: string; avatar: string; name: string };
export type HomeHighlightClub = { id: string | null; avatar: string; name: string };
type RankRow = { rankNo?: number; userId?: number | string | null; avatar?: string | null; nickname?: string | null; metricValue?: number | string | null };
type ClubRow = { id?: number | string | null; clubName?: string | null; logoUrl?: string | null };
type Envelope = { code?: string; info?: string; data?: unknown };

function list<T>(response: Envelope): T[] {
  if (response.code !== "SUCCESS") {
    throw new Error(response.info || "热门内容加载失败");
  }
  const data = response.data;
  if (Array.isArray(data)) {
    return data.filter((item) => item && typeof item === "object");
  }
  if (data && typeof data === "object") {
    const page = data as { records?: unknown; list?: unknown };
    const rows = page.records ?? page.list;
    if (Array.isArray(rows)) {
      return rows.filter((item) => item && typeof item === "object");
    }
  }
  return [];
}

function positiveId(value: unknown): string | null {
  const id = String(value ?? "");
  return /^[1-9]\d*$/.test(id) ? id : null;
}

export async function fetchHomeBroadcasts(signal?: AbortSignal): Promise<HomeBroadcast[]> {
  const rows = list<RankRow>(await apiClient<Envelope>("/client/v1/rank/rechargeTop", { signal }));
  return rows.flatMap((row, index) => {
    const amount = Number(row.metricValue);
    if (!Number.isFinite(amount) || Math.round(amount) <= 0) {
      return [];
    }
    return [{ id: `${row.rankNo ?? index}-${row.userId ?? index}`, avatar: row.avatar || "", nickname: row.nickname?.trim() || "用户", amount: Math.round(amount) }];
  });
}

export async function fetchHomeHighlightRanking(signal?: AbortSignal): Promise<HomeHighlightPerson[]> {
  const rows = list<RankRow>(await apiClient<Envelope>("/client/v1/rank/top?boardCode=ORDER_RECEIVE&rankType=WEEKLY&gameId=0", { signal }));
  return rows.flatMap((row) => {
    const id = positiveId(row.userId);
    return id ? [{ id, avatar: row.avatar || "", name: row.nickname?.trim() || "用户" }] : [];
  }).slice(0, 3);
}

export async function fetchHomeHighlightClubs(signal?: AbortSignal): Promise<HomeHighlightClub[]> {
  const rows = list<ClubRow>(await apiClient<Envelope>("/client/v1/club/public/recommend/home", { signal }));
  return rows.filter((row) => row.clubName?.trim()).slice(0, 3).map((row) => ({
    id: positiveId(row.id), avatar: row.logoUrl || "", name: row.clubName!.trim(),
  }));
}

/** 兼容旧接口只下发名称和头像的情况，不把名称当作详情页 ID。 */
export async function resolveHomeHighlightClub(club: HomeHighlightClub, signal?: AbortSignal): Promise<string> {
  if (club.id) {
    return club.id;
  }
  const rows = list<ClubRow>(await apiClient<Envelope>("/client/v1/club/public/page", {
    method: "POST", body: { page: 1, pageSize: 20, action: { clubName: club.name } }, signal,
  }));
  const matching = rows.filter((row) => row.clubName === club.name && positiveId(row.id));
  const row = matching.find((item) => item.logoUrl === club.avatar) ?? matching[0];
  const id = positiveId(row?.id);
  if (!id) {
    throw new Error("未找到该俱乐部详情");
  }
  return id;
}
