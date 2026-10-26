export const COMPANION_INTRO_MAX_LENGTH = 140;

export type ManagementAccount = { userId: string; clubId: string };
export type ManagementGame = ManagementAccount & { gameId: string };
export type ManagedGame = {
  gameId: number;
  gameName: string;
  companionGameId?: number;
};
export type ManagedImage = { id: number; imageUrl: string; sortNo?: number };
export type ManagedGameDetail = {
  companionGameId?: number;
  gameId?: number;
  gameName?: string;
  skillIntro?: string;
  voiceUrl?: string | null;
  voiceDurationSeconds?: number | null;
  images?: ManagedImage[];
  skillCards?: {
    companionServiceId: number;
    goodRate?: number | string | null;
  }[];
};
export type ManagedService = {
  companionServiceId: number;
  clubGameServiceName?: string;
  price?: number | string | null;
  status?: number;
  orderCount?: number | null;
  goodRate?: number | string | null;
  unit?: string;
};
export type ManagedServiceLevel = {
  id: number;
  levelName?: string;
  gameModeId?: number;
  gameModeName?: string;
  companionServiceList?: ManagedService[];
};
export type CompanionWallet = {
  withdrawablePan?: number | string;
  pendingPan?: number | string;
  totalIncomePan?: number | string;
};
export type CompanionOrderStat = {
  currentOrderCount?: number | string;
  totalCompletedCount?: number | string;
  goodRate?: number | string | null;
};
export type WalletEntry = {
  id: number;
  transactionType?: string;
  transactionTypeDesc?: string;
  amount?: number | string;
  /** 该笔流水后的剩余竹子余额；接口暂未返回时按 0 展示。 */
  remainAmount?: number | string | null;
  relatedOrderNo?: string;
  remark?: string;
  createTime?: string;
};
export type WalletPage = {
  page?: number;
  pages?: number;
  total?: number;
  records?: WalletEntry[];
};
export type ManagementRequestOptions = {
  method: "GET" | "POST";
  token: string;
  body?: unknown;
  signal?: AbortSignal;
};
export type ManagementRequester = <T>(
  path: string,
  options: ManagementRequestOptions,
) => Promise<{
  code: string;
  info?: string;
  data?: T | null;
}>;

function id(value: string) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0)
    throw new Error("账号或游戏信息不完整，请重新进入");
  return number;
}
function gameBody(context: ManagementGame) {
  return { clubId: id(context.clubId), gameId: id(context.gameId) };
}

export function createCompanionManagementApi(requester: ManagementRequester) {
  async function request<T>(path: string, options: ManagementRequestOptions) {
    if (!options.token) throw new Error("请先登录");
    const response = await requester<T>(path, options);
    if (response.code !== "SUCCESS")
      throw new Error(response.info || "请求失败，请重试");
    return response.data;
  }
  async function required<T>(path: string, options: ManagementRequestOptions) {
    const data = await request<T>(path, options);
    if (data == null) throw new Error("服务未返回数据，请重试");
    return data;
  }
  return {
    wallet: (token: string, signal?: AbortSignal) =>
      required<CompanionWallet>("/client/v1/companion/wallet/result", {
        method: "GET",
        token,
        signal,
      }),
    orderStat: (token: string, signal?: AbortSignal) =>
      required<CompanionOrderStat>("/client/v1/companion/order/stat", {
        method: "GET",
        token,
        signal,
      }),
    async games(
      context: ManagementAccount,
      token: string,
      signal?: AbortSignal,
    ) {
      const data = await required<{ games?: ManagedGame[] }>(
        "/client/v1/companion/public/detail",
        {
          method: "POST",
          token,
          signal,
          body: { clubId: id(context.clubId), userId: id(context.userId) },
        },
      );
      return (data.games ?? []).filter((game) => Number(game.gameId) > 0);
    },
    gameDetail: (
      context: ManagementGame,
      token: string,
      signal?: AbortSignal,
    ) =>
      required<ManagedGameDetail>("/client/v1/companion/public/game/detail", {
        method: "POST",
        token,
        signal,
        body: { ...gameBody(context), userId: id(context.userId) },
      }),
    async services(
      context: ManagementGame,
      token: string,
      signal?: AbortSignal,
    ) {
      return (
        (await request<ManagedServiceLevel[]>(
          "/client/v1/companion/companion/getCompanionGameModeLevelServiceList",
          {
            method: "POST",
            token,
            signal,
            body: { ...gameBody(context), companionUserId: id(context.userId) },
          },
        )) ?? []
      );
    },
    async updateIntro(
      context: ManagementGame,
      token: string,
      skillIntro: string,
    ) {
      const intro = skillIntro.trim();
      if (!intro) throw new Error("请输入能力介绍");
      if (Array.from(intro).length > COMPANION_INTRO_MAX_LENGTH) {
        throw new Error(`简介最多${COMPANION_INTRO_MAX_LENGTH}字`);
      }
      return request("/client/v1/companion/game/updateSkillIntro", {
        method: "POST",
        token,
        body: { ...gameBody(context), skillIntro: intro },
      });
    },
    updateVoice: (
      context: ManagementGame,
      token: string,
      voiceUrl: string,
      voiceDurationSeconds: number,
    ) =>
      request("/client/v1/companion/game/updateVoice", {
        method: "POST",
        token,
        body: { ...gameBody(context), voiceUrl, voiceDurationSeconds },
      }),
    addImage: (context: ManagementGame, token: string, imageUrl: string) =>
      request<ManagedImage>("/client/v1/companion/game/addImage", {
        method: "POST",
        token,
        body: { ...gameBody(context), imageUrl },
      }),
    deleteImage: (token: string, imageId: number) =>
      request("/client/v1/companion/game/deleteImage", {
        method: "POST",
        token,
        body: { imageId },
      }),
    updateService: (
      context: ManagementGame,
      token: string,
      companionServiceId: number,
      enabled: boolean,
    ) =>
      request("/client/v1/companion/game/updateServiceStatus", {
        method: "POST",
        token,
        body: { ...gameBody(context), companionServiceId, enabled },
      }),
    async walletFilters(token: string, signal?: AbortSignal) {
      return (
        (await request<{ key: string; label: string }[]>(
          "/client/v1/companion/wallet/detail/filters",
          { method: "GET", token, signal },
        )) ?? []
      );
    },
    walletPage: (
      token: string,
      page: number,
      transactionType?: string,
      signal?: AbortSignal,
    ) =>
      required<WalletPage>("/client/v1/companion/wallet/detail/page", {
        method: "POST",
        token,
        signal,
        body: {
          page,
          pageSize: 20,
          action: transactionType ? { transactionType } : {},
        },
      }),
  };
}

export function formatManagementNumber(
  value: unknown,
  digits?: number,
): string {
  if (value == null || value === "" || typeof value === "boolean") return "--";
  const number = Number(value);
  return Number.isFinite(number)
    ? digits == null
      ? String(number)
      : number.toFixed(digits)
    : "--";
}

export function walletNextPage(page: WalletPage, requestedPage: number) {
  const count = page.records?.length ?? 0;
  if (count === 0) return undefined;
  if (page.pages != null)
    return requestedPage < page.pages ? requestedPage + 1 : undefined;
  if (page.total != null)
    return requestedPage * 20 < page.total ? requestedPage + 1 : undefined;
  return count === 20 ? requestedPage + 1 : undefined;
}
