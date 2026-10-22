import { apiClient } from "@/core/network/api-client";

import type {
  MatchClub,
  MatchGame,
  MatchLevel,
  MatchMode,
  MatchService,
} from "./match.types";

type ApiEnvelope<T> = { success?: boolean; code?: string; info?: string; data?: T };

type ApiGame = {
  id: number | string;
  gameName?: string;
  iconUrl?: string;
  gameCategory?: number;
};

type ApiClub = {
  id: number | string;
  clubName?: string;
  logoUrl?: string;
  memberCount?: number;
};

type ApiMode = {
  id: number | string;
  modeName?: string;
};

type ApiLevel = {
  id: number | string;
  levelName?: string;
};

type ApiService = {
  id: number | string;
  serviceName?: string;
  malePrice?: number | string;
  femalePrice?: number | string;
  billingUnitName?: string;
  supportMultiCompanion?: boolean;
};

function requireSuccess<T>(response: ApiEnvelope<T>, fallback: string): T {
  if (response.code !== "SUCCESS" || response.data === undefined) {
    throw new Error(response.info || fallback);
  }
  return response.data;
}

function toNumber(value: number | string | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export async function fetchQuickMatchGames(
  token: string,
  signal?: AbortSignal,
): Promise<MatchGame[]> {
  const response = await apiClient<ApiEnvelope<ApiGame[]>>(
    "/client/v1/companion/getQuickMatchGameList",
    { method: "GET", token, signal },
  );
  const list = requireSuccess(response, "游戏列表加载失败");
  return (list ?? []).map((item) => ({
    id: String(item.id),
    name: item.gameName || "未命名游戏",
    iconUrl: item.iconUrl,
  }));
}

export async function fetchQuickMatchClubs(
  gameId: string,
  token: string,
  signal?: AbortSignal,
): Promise<MatchClub[]> {
  const response = await apiClient<ApiEnvelope<ApiClub[]>>(
    `/client/v1/companion/getQuickMatchClubList?gameId=${encodeURIComponent(gameId)}`,
    { method: "GET", token, signal },
  );
  const list = requireSuccess(response, "俱乐部列表加载失败");
  return (list ?? []).map((item) => ({
    id: String(item.id),
    name: item.clubName || "未命名俱乐部",
    logoUrl: item.logoUrl,
    memberCount: item.memberCount,
  }));
}

export async function fetchClubGameModes(
  clubId: string,
  gameId: string,
  token: string,
  signal?: AbortSignal,
): Promise<MatchMode[]> {
  const response = await apiClient<ApiEnvelope<ApiMode[]>>(
    `/client/v1/companion/getClubGameModeList?clubId=${encodeURIComponent(clubId)}&gameId=${encodeURIComponent(gameId)}`,
    { method: "GET", token, signal },
  );
  const list = requireSuccess(response, "模式列表加载失败");
  return (list ?? []).map((item) => ({
    id: String(item.id),
    name: item.modeName || "未命名模式",
  }));
}

export async function fetchClubGameLevels(
  gameModeId: string,
  token: string,
  signal?: AbortSignal,
): Promise<MatchLevel[]> {
  const response = await apiClient<ApiEnvelope<ApiLevel[]>>(
    `/client/v1/companion/getClubGameLevelList?gameModeId=${encodeURIComponent(gameModeId)}`,
    { method: "GET", token, signal },
  );
  const list = requireSuccess(response, "等级列表加载失败");
  return (list ?? []).map((item) => ({
    id: String(item.id),
    name: item.levelName || "未命名等级",
  }));
}

export async function fetchClubGameServices(
  gameLevelId: string,
  token: string,
  signal?: AbortSignal,
): Promise<MatchService[]> {
  const response = await apiClient<ApiEnvelope<ApiService[]>>(
    `/client/v1/companion/getClubGameServiceList?gameLevelId=${encodeURIComponent(gameLevelId)}`,
    { method: "GET", token, signal },
  );
  const list = requireSuccess(response, "服务列表加载失败");
  return (list ?? []).map((item) => ({
    id: String(item.id),
    name: item.serviceName || "未命名服务",
    malePrice: toNumber(item.malePrice),
    femalePrice: toNumber(item.femalePrice),
    billingUnitName: item.billingUnitName,
    supportMultiCompanion: Boolean(item.supportMultiCompanion),
  }));
}
