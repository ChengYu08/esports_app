import type {
  ProfileDetail,
  ProfileGameDetail,
  ProfileGameRouteParams,
  ProfileReviewPage,
  ProfileRouteParams,
} from "./profile.types";

type ApiEnvelope<T> = {
  success?: boolean;
  code?: string;
  info?: string;
  data?: T;
};

type ProfileRequester = <T>(
  path: string,
  options: { method: "POST"; body: unknown; signal?: AbortSignal },
) => Promise<ApiEnvelope<T>>;

type ApiProfileGame = {
  companionGameId?: number;
  gameId?: number;
  gameName?: string;
  iconUrl?: string;
  backgroundUrl?: string;
};

type ApiProfileDetail = {
  userId?: number;
  nickname?: string;
  signature?: string;
  headImage?: string;
  sex?: number;
  birth?: string;
  followCount?: number;
  fansCount?: number;
  profileId?: number;
  clubId?: number;
  clubName?: string;
  logoUrl?: string;
  orderCount?: number;
  onlineStatus?: number;
  gameStatus?: number;
  games?: ApiProfileGame[];
};

type ApiProfileImage = {
  id?: number;
  imageUrl?: string;
  sortNo?: number;
};

type ApiProfileSkillCard = {
  companionServiceId?: number;
  gameId?: string | number;
  gameModeId?: number;
  modeName?: string;
  gameLevelId?: number;
  levelName?: string;
  clubGameServiceId?: number;
  price?: number | string;
  orderCount?: number;
  goodRate?: number | string | null;
};

type ApiProfileGameDetail = {
  companionGameId?: number;
  userId?: number;
  clubId?: number;
  gameId?: number;
  gameName?: string;
  iconUrl?: string;
  backgroundUrl?: string;
  skillIntro?: string;
  voiceUrl?: string;
  voiceDurationSeconds?: number;
  images?: ApiProfileImage[];
  skillCards?: ApiProfileSkillCard[];
};

type ApiProfileReview = {
  id?: number;
  orderNo?: string;
  buyerNickname?: string;
  buyerAvatar?: string;
  anonymous?: boolean;
  rating?: number;
  content?: string;
  imageUrls?: string[];
  evaluatedTime?: string;
};

type ApiProfileReviewPage = {
  page?: number;
  totalPages?: number;
  total?: number;
  records?: ApiProfileReview[];
  list?: ApiProfileReview[];
};

function requireSuccess<T>(response: ApiEnvelope<T>, fallback: string): T {
  if (response.code !== "SUCCESS" || response.data === undefined) {
    throw new Error(response.info || fallback);
  }
  return response.data;
}

function toId(value: string, field: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new Error(`${field}无效`);
  return id;
}

function mapProfileDetail(data: ApiProfileDetail): ProfileDetail {
  return {
    userId: data.userId ?? 0,
    nickname: data.nickname || "未命名用户",
    signature: data.signature || "",
    headImage: data.headImage,
    sex: data.sex,
    birth: data.birth,
    followCount: data.followCount ?? 0,
    fansCount: data.fansCount ?? 0,
    profileId: data.profileId,
    clubId: data.clubId ?? 0,
    clubName: data.clubName || "未命名俱乐部",
    logoUrl: data.logoUrl,
    orderCount: data.orderCount ?? 0,
    onlineStatus: data.onlineStatus ?? 0,
    gameStatus: data.gameStatus ?? 0,
    games: (data.games ?? [])
      .filter((game) => game.gameId !== undefined)
      .map((game) => ({
        companionGameId: game.companionGameId ?? 0,
        gameId: game.gameId as number,
        gameName: game.gameName || "未命名游戏",
        iconUrl: game.iconUrl,
        backgroundUrl: game.backgroundUrl,
      })),
  };
}

function mapGameDetail(data: ApiProfileGameDetail): ProfileGameDetail {
  return {
    companionGameId: data.companionGameId ?? 0,
    userId: data.userId ?? 0,
    clubId: data.clubId ?? 0,
    gameId: data.gameId ?? 0,
    gameName: data.gameName || "未命名游戏",
    iconUrl: data.iconUrl,
    backgroundUrl: data.backgroundUrl,
    skillIntro: data.skillIntro || "",
    voiceUrl: data.voiceUrl,
    voiceDurationSeconds: data.voiceDurationSeconds ?? 0,
    images: (data.images ?? [])
      .filter((image) => Boolean(image.imageUrl))
      .sort((a, b) => (a.sortNo ?? 0) - (b.sortNo ?? 0))
      .map((image) => ({
        id: image.id ?? 0,
        imageUrl: image.imageUrl as string,
        sortNo: image.sortNo ?? 0,
      })),
    skillCards: (data.skillCards ?? []).map((card) => ({
      companionServiceId: card.companionServiceId ?? 0,
      gameId: String(card.gameId ?? data.gameId ?? ""),
      gameModeId: card.gameModeId ?? 0,
      modeName: card.modeName || "服务",
      gameLevelId: card.gameLevelId ?? 0,
      levelName: card.levelName || "默认服务",
      clubGameServiceId: card.clubGameServiceId ?? 0,
      price: Number(card.price) || 0,
      orderCount: card.orderCount ?? 0,
      goodRate: card.goodRate === null || card.goodRate === undefined ? null : Number(card.goodRate),
    })),
  };
}

function mapReviews(data: ApiProfileReviewPage): ProfileReviewPage {
  const records = data.records ?? data.list ?? [];
  const page = data.page ?? 1;
  const totalPages = data.totalPages ?? 1;
  return {
    page,
    totalPages,
    total: data.total ?? records.length,
    hasMore: page < totalPages,
    items: records.map((review) => ({
      id: review.id ?? 0,
      orderNo: review.orderNo,
      buyerNickname: review.anonymous ? "匿名" : review.buyerNickname || "匿名",
      buyerAvatar: review.anonymous ? undefined : review.buyerAvatar,
      anonymous: review.anonymous ?? false,
      rating: Math.max(0, Math.min(5, review.rating ?? 0)),
      content: review.content || "",
      imageUrls: review.imageUrls ?? [],
      evaluatedTime: review.evaluatedTime,
    })),
  };
}

export function getProfileRouteParams(params: {
  clubId?: string | string[];
  userId?: string | string[];
}, currentUserId?: string): ProfileRouteParams | null {
  const userId = params.userId ?? currentUserId;
  if (typeof userId !== "string" || !userId.trim()) {
    return null;
  }
  if (params.clubId !== undefined && typeof params.clubId !== "string") return null;
  const clubId = typeof params.clubId === "string" && params.clubId.trim() ? params.clubId : undefined;
  return { ...(clubId ? { clubId } : {}), userId };
}

export function getFirstProfileGameId(games: { gameId: number }[]): string {
  return games[0] ? String(games[0].gameId) : "";
}

export function createProfileContract(requester: ProfileRequester) {
  return {
    async fetchProfileDetail(params: ProfileRouteParams, signal?: AbortSignal) {
      const data = requireSuccess(
        await requester<ApiProfileDetail>("/client/v1/companion/public/detail", {
          method: "POST",
          body: { userId: toId(params.userId, "用户ID") },
          ...(signal ? { signal } : {}),
        }),
        "个人主页加载失败",
      );
      return mapProfileDetail(data);
    },

    async fetchProfileGameDetail(params: ProfileGameRouteParams, signal?: AbortSignal) {
      const data = requireSuccess(
        await requester<ApiProfileGameDetail>("/client/v1/companion/public/game/detail", {
          method: "POST",
          body: {
            clubId: toId(params.clubId, "俱乐部ID"),
            userId: toId(params.userId, "用户ID"),
            gameId: toId(params.gameId, "游戏ID"),
          },
          ...(signal ? { signal } : {}),
        }),
        "游戏技能加载失败",
      );
      return mapGameDetail(data);
    },

    async fetchProfileReviews(params: { gameId: string; companionUserId: string; page?: number; pageSize?: number; signal?: AbortSignal }) {
      const page = params.page ?? 1;
      const pageSize = params.pageSize ?? 20;
      const data = requireSuccess(
        await requester<ApiProfileReviewPage>("/client/v1/afterSale/public/review/page", {
          method: "POST",
          body: {
            page,
            pageSize,
            action: {
              gameId: toId(params.gameId, "游戏ID"),
              companionUserId: toId(params.companionUserId, "用户ID"),
            },
          },
          ...(params.signal ? { signal: params.signal } : {}),
        }),
        "评价加载失败",
      );
      return mapReviews(data);
    },
  };
}
