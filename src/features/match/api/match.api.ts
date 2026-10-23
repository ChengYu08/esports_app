import { apiClient } from "@/core/network/api-client";

import type {
  MatchClub,
  MatchGame,
  MatchLevel,
  MatchMode,
  MatchService,
  PublishQuickMatchPayload,
  QuickMatchAuditionRoom,
  QuickMatchGrabItem,
  QuickMatchPayable,
  QuickMatchPublishResult,
  QuickMatchRequestDetail,
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

type ApiGrab = {
  id: number | string;
  requestNo?: string;
  companionUserId?: number | string;
  companionServiceId?: number | string;
  nickname?: string;
  headImage?: string;
  sex?: number | string;
  grabStatus?: string;
  remark?: string;
  clubId?: number | string;
};

type ApiRequestDetail = {
  requestNo?: string;
  clubId?: number | string;
  gameId?: number | string;
  gameModeId?: number | string;
  gameLevelId?: number | string;
  gameServiceId?: number | string;
  gameName?: string;
  modeName?: string;
  levelName?: string;
  serviceName?: string;
  billingUnitName?: string;
  genderRequirement?: number;
  quantity?: number;
  needVoice?: boolean;
  companionPreference?: 1 | 2 | null;
  roomId?: number | string | null;
  roomVersion?: number | string | null;
  remark?: string;
  status?: string;
  expireTime?: string;
};

type ApiPayable = {
  orderCount?: number;
  totalPrice?: number | string;
};

function requireSuccess<T>(response: ApiEnvelope<T>, fallback: string): T {
  if (response.code !== "SUCCESS" || response.data === undefined) {
    throw new Error(response.info || fallback);
  }
  return response.data;
}

function requireVoidSuccess(response: ApiEnvelope<unknown>, fallback: string): void {
  if (response.code !== "SUCCESS") {
    throw new Error(response.info || fallback);
  }
}

function toNumber(value: number | string | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toOptionalString(value: number | string | null | undefined): string | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  return String(value);
}

function mapRequestDetail(item: ApiRequestDetail | null | undefined): QuickMatchRequestDetail | null {
  if (!item?.requestNo) return null;
  return {
    requestNo: String(item.requestNo),
    clubId: toOptionalString(item.clubId),
    gameId: toOptionalString(item.gameId),
    gameModeId: toOptionalString(item.gameModeId),
    gameLevelId: toOptionalString(item.gameLevelId),
    gameServiceId: toOptionalString(item.gameServiceId),
    gameName: item.gameName,
    modeName: item.modeName,
    levelName: item.levelName,
    serviceName: item.serviceName,
    billingUnitName: item.billingUnitName,
    genderRequirement: item.genderRequirement,
    quantity: item.quantity,
    needVoice: Boolean(item.needVoice),
    companionPreference: item.companionPreference ?? null,
    roomId: item.roomId == null ? null : String(item.roomId),
    roomVersion: item.roomVersion == null ? null : String(item.roomVersion),
    remark: item.remark,
    status: item.status,
    expireTime: item.expireTime,
  };
}

function mapGrabItem(item: ApiGrab): QuickMatchGrabItem {
  const sexNum = Number(item.sex);
  const sex: 0 | 1 | 2 = sexNum === 1 || sexNum === 2 ? sexNum : 0;
  return {
    id: String(item.id),
    requestNo: item.requestNo,
    companionUserId: toOptionalString(item.companionUserId),
    companionServiceId: toOptionalString(item.companionServiceId),
    nickname: item.nickname || "陪玩",
    headImage: item.headImage,
    sex,
    grabStatus: item.grabStatus as QuickMatchGrabItem["grabStatus"],
    remark: item.remark,
    clubId: toOptionalString(item.clubId),
  };
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

export async function publishQuickMatch(
  payload: PublishQuickMatchPayload,
  token: string,
): Promise<QuickMatchPublishResult> {
  const response = await apiClient<ApiEnvelope<QuickMatchPublishResult>>(
    "/client/v1/quickMatch/publish",
    { method: "POST", token, body: { action: payload } },
  );
  const data = requireSuccess(response, "发布失败，请重试");
  return {
    requestNo: String(data.requestNo),
    roomId: data.roomId,
    roomVersion: data.roomVersion,
    expireTime: data.expireTime,
  };
}

export async function fetchQuickMatchDetail(
  requestNo: string,
  token: string,
  signal?: AbortSignal,
): Promise<QuickMatchRequestDetail> {
  const response = await apiClient<ApiEnvelope<ApiRequestDetail>>(
    `/client/v1/quickMatch/detail?requestNo=${encodeURIComponent(requestNo)}`,
    { method: "GET", token, signal },
  );
  const data = requireSuccess(response, "需求详情加载失败");
  const mapped = mapRequestDetail(data);
  if (!mapped) throw new Error("需求详情加载失败");
  return mapped;
}

export async function fetchActiveQuickMatch(
  token: string,
  signal?: AbortSignal,
): Promise<QuickMatchRequestDetail | null> {
  const response = await apiClient<ApiEnvelope<ApiRequestDetail | null>>(
    "/client/v1/quickMatch/active/detail",
    { method: "GET", token, signal },
  );
  if (response.code !== "SUCCESS") {
    throw new Error(response.info || "进行中需求查询失败");
  }
  return mapRequestDetail(response.data ?? null);
}

export async function fetchQuickMatchGrabList(
  requestNo: string,
  token: string,
  signal?: AbortSignal,
): Promise<QuickMatchGrabItem[]> {
  const response = await apiClient<ApiEnvelope<ApiGrab[]>>(
    `/client/v1/quickMatch/grab/list?requestNo=${encodeURIComponent(requestNo)}`,
    { method: "GET", token, signal },
  );
  const list = requireSuccess(response, "抢单列表加载失败");
  return (list ?? []).map(mapGrabItem);
}

export async function cancelQuickMatch(requestNo: string, token: string): Promise<void> {
  const response = await apiClient<ApiEnvelope<unknown>>("/client/v1/quickMatch/cancel", {
    method: "POST",
    token,
    body: { action: { requestNo } },
  });
  requireVoidSuccess(response, "取消派单失败，请稍后重试");
}

export async function selectAndCreateOrder(
  requestNo: string,
  grabIds: string[],
  token: string,
): Promise<{ totalPrice: number }> {
  const response = await apiClient<ApiEnvelope<{ totalPrice?: number | string }>>(
    "/client/v1/quickMatch/selectAndCreateOrder",
    {
      method: "POST",
      token,
      body: { action: { requestNo, grabIds } },
    },
  );
  const data = requireSuccess(response, "创建订单失败");
  return { totalPrice: toNumber(data.totalPrice) };
}

export async function fetchQuickMatchPayable(
  requestNo: string,
  token: string,
): Promise<QuickMatchPayable> {
  const response = await apiClient<ApiEnvelope<ApiPayable>>(
    `/client/v1/quickMatch/batchPay/payable?requestNo=${encodeURIComponent(requestNo)}`,
    { method: "GET", token },
  );
  const data = requireSuccess(response, "待支付金额查询失败");
  return {
    orderCount: Number(data.orderCount) || 0,
    totalPrice: toNumber(data.totalPrice),
  };
}

export async function batchPayQuickMatch(requestNo: string, token: string): Promise<void> {
  const response = await apiClient<ApiEnvelope<unknown>>("/client/v1/quickMatch/batchPay", {
    method: "POST",
    token,
    body: { action: { requestNo } },
  });
  requireVoidSuccess(response, "支付失败");
}

export async function ensureAuditionRoom(
  requestNo: string,
  token: string,
): Promise<QuickMatchAuditionRoom> {
  const response = await apiClient<ApiEnvelope<Record<string, unknown>>>(
    "/client/v1/quickMatch/auditionRoom/ensure",
    { method: "POST", token, body: { action: { requestNo } } },
  );
  const data = requireSuccess(response, "试音房创建失败");
  const id =
    data.id != null
      ? String(data.id)
      : data.roomId != null
        ? String(data.roomId)
        : data.voiceRoomId != null
          ? String(data.voiceRoomId)
          : "";
  if (!id) throw new Error("试音房信息不存在");
  return {
    id,
    roomVersion: (data.roomVersion as string | number | undefined) ?? undefined,
    roomName: typeof data.roomName === "string" ? data.roomName : undefined,
    creatorUserId: (data.creatorUserId as string | number | undefined) ?? undefined,
  };
}
