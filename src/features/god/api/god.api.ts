import { apiClient } from "@/core/network/api-client";

export type GodFilters = {
  /** '' 不限 / male / female */
  gender: string;
  /** '' 不限 / online 空闲中 / busy 游戏中 */
  status: string;
  /** '' 不限 / asc 从低到高 / desc 从高到低 */
  price: string;
  /** '' 不限 / 等级名：金牌、顶尖、明星、魔王pro、娱乐、颜值娱乐、人气护 */
  level: string;
};

export const GOD_EMPTY_FILTERS: GodFilters = {
  gender: "",
  status: "",
  price: "",
  level: "",
};

type ApiGodRecord = {
  profileId: number;
  clubId: number;
  userId: number;
  nickname?: string;
  headImage?: string;
  coverUrl?: string;
  sex?: number;
  age?: number | string;
  signature?: string;
  onlineStatus?: number | null;
  gameStatus?: number | null;
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
  price?: number | string;
  orderCount?: number;
  voiceUrl?: string | null;
  voiceDurationSeconds?: number | null;
};

export type GodListItem = {
  userId: number;
  clubId: number;
  nickname: string;
  avatar: string;
  sex: number;
  age: number | null;
  signature: string;
  gameName: string;
  /** 卡内陪玩标签名（明星/魔王pro 等），空表示不展示标签 */
  tagName: string;
  /** 标签背景色：优先移动端色值，后台未配置时由 UI 兜底 */
  tagColor: string;
  /** 卡片第三行斜杠文本三要素：游戏模式 / 游戏等级 / 服务 */
  modeName: string;
  levelName: string;
  serviceName: string;
  onlineStatus: number;
  gameStatus: number;
  price: number;
  orderCount: number;
  voiceUrl: string | null;
  voiceDurationSeconds: number | null;
};

type GodEnvelope = {
  code?: string;
  info?: string;
  data?: { records?: ApiGodRecord[]; total?: number };
};

const SEX_VALUES: Record<string, number> = { male: 1, female: 2 };
const STATUS_VALUES: Record<string, number> = { online: 0, busy: 1 };
const PRICE_SORTS: Record<string, string> = { asc: "ASC", desc: "DESC" };

/** 大神列表：与 PC「大神」页同一接口，按游戏 + 性别/状态/价格筛选分页 */
export async function fetchGodPage(params: {
  gameId: number | null;
  filters: GodFilters;
  page: number;
  pageSize?: number;
  signal?: AbortSignal;
}): Promise<{ items: GodListItem[]; total: number }> {
  const { gameId, filters, page, pageSize = 10, signal } = params;
  const action: Record<string, unknown> = {};
  if (gameId != null) action.gameId = gameId;
  const sex = SEX_VALUES[filters.gender];
  if (sex) action.sex = sex;
  const gameStatus = STATUS_VALUES[filters.status];
  if (gameStatus != null) action.gameStatus = gameStatus;
  const priceSort = PRICE_SORTS[filters.price];
  if (priceSort) action.priceSort = priceSort;
  if (filters.level) action.levelName = filters.level;

  const response = await apiClient<GodEnvelope>("/client/v1/companion/public/home/page", {
    method: "POST",
    body: { page, pageSize, action },
    signal,
  });
  const records = response.data?.records ?? [];
  const items = records.map((row) => ({
    userId: row.userId,
    clubId: row.clubId,
    nickname: row.nickname || "未命名",
    avatar: row.coverUrl || row.headImage || "",
    sex: row.sex ?? 0,
    age: row.age != null && row.age !== "" ? Number(row.age) : null,
    signature: row.signature || "",
    gameName: row.gameName || "",
    tagName: row.tagName || "",
    tagColor: row.tagMobileBackgroundColor || row.tagBackgroundColor || "",
    modeName: row.modeName || "",
    levelName: row.levelName || "",
    serviceName: row.clubGameServiceName || "",
    onlineStatus: row.onlineStatus ?? 0,
    gameStatus: row.gameStatus ?? 0,
    price: Number(row.price) || 0,
    orderCount: row.orderCount ?? 0,
    voiceUrl: row.voiceUrl ?? null,
    voiceDurationSeconds: row.voiceDurationSeconds ?? null,
  }));
  const total = items.length ? response.data?.total ?? items.length : items.length;
  return { items, total };
}
