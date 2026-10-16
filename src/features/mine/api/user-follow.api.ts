import { apiClient, type RequestOptions } from "@/core/network/api-client";

export type UserFollowType = "following" | "fans";

export type UserFollowState = {
  followed: boolean;
  mutual: boolean;
  followCount: number;
  fansCount: number;
};

export type UserFollowCount = {
  followCount: number;
  fansCount: number;
};

export type UserFollowUser = {
  userId: string;
  nickname: string;
  avatar?: string;
  gender?: number;
  age?: number | null;
  signature: string;
  clubId?: string;
  followedBack: boolean;
  mutual: boolean;
  relationTime?: string;
};

export type UserFollowPage = {
  page: number;
  items: UserFollowUser[];
  hasMore: boolean;
  total?: number;
};

type ApiEnvelope<T> = {
  code?: string;
  info?: string;
  data?: T;
};

type ApiFollowState = {
  followed?: boolean;
  mutual?: boolean;
  followCount?: number;
  fansCount?: number;
};

type ApiFollowCount = {
  followCount?: number;
  fansCount?: number;
};

type ApiFollowUser = {
  userId?: string | number;
  nickname?: string;
  avatar?: string;
  gender?: number;
  age?: number | null;
  signature?: string;
  clubId?: string | number | null;
  followedBack?: boolean;
  mutual?: boolean;
  relationTime?: string;
};

type ApiFollowPage = {
  page?: number;
  totalPages?: number;
  total?: number;
  records?: ApiFollowUser[];
  list?: ApiFollowUser[];
};

async function request<T>(
  path: string,
  options: RequestOptions,
): Promise<T> {
  const response = await apiClient<ApiEnvelope<T>>(path, options);
  if (response.code !== "SUCCESS" || response.data === undefined) {
    throw new Error(response.info || "请求失败");
  }
  return response.data;
}

function mapFollowState(data: ApiFollowState): UserFollowState {
  return {
    followed: Boolean(data.followed),
    mutual: Boolean(data.mutual),
    followCount: data.followCount ?? 0,
    fansCount: data.fansCount ?? 0,
  };
}

function mapFollowCount(data: ApiFollowCount): UserFollowCount {
  return {
    followCount: data.followCount ?? 0,
    fansCount: data.fansCount ?? 0,
  };
}

function mapFollowUser(data: ApiFollowUser): UserFollowUser | null {
  const userId = String(data.userId ?? "");
  if (!userId || userId === "0") return null;
  return {
    userId,
    nickname: data.nickname || "未命名",
    avatar: data.avatar,
    gender: data.gender,
    age: data.age,
    signature: data.signature || "",
    clubId: data.clubId == null ? undefined : String(data.clubId),
    followedBack: Boolean(data.followedBack),
    mutual: Boolean(data.mutual),
    relationTime: data.relationTime,
  };
}

export async function fetchUserFollowState(
  followUserId: string,
  token: string,
  signal?: AbortSignal,
): Promise<UserFollowState> {
  const data = await request<ApiFollowState>(
    `/client/v1/userFollow/state?followUserId=${encodeURIComponent(followUserId)}`,
    { method: "GET", token, signal },
  );
  return mapFollowState(data);
}

export async function fetchUserFollowCount(
  userId: string,
  token?: string,
  signal?: AbortSignal,
): Promise<UserFollowCount> {
  const path = token
    ? "/client/v1/userFollow/count"
    : "/client/v1/userFollow/public/count";
  const data = await request<ApiFollowCount>(
    `${path}?userId=${encodeURIComponent(userId)}`,
    { method: "GET", signal, ...(token ? { token } : {}) },
  );
  return mapFollowCount(data);
}

export async function fetchUserFollowPage(params: {
  userId: string;
  type: UserFollowType;
  page: number;
  pageSize: number;
  token?: string;
  signal?: AbortSignal;
}): Promise<UserFollowPage> {
  const path = params.token
    ? "/client/v1/userFollow/page"
    : "/client/v1/userFollow/public/page";
  const query = [
    ["userId", params.userId],
    ["type", params.type],
    ["page", String(params.page)],
    ["pageSize", String(params.pageSize)],
  ]
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join("&");
  const data = await request<ApiFollowPage>(`${path}?${query}`, {
    method: "GET",
    signal: params.signal,
    ...(params.token ? { token: params.token } : {}),
  });
  const items = (data.records ?? data.list ?? [])
    .map(mapFollowUser)
    .filter((user): user is UserFollowUser => user !== null);
  const page = data.page ?? params.page;
  return {
    page,
    items,
    total: data.total,
    hasMore:
      data.totalPages !== undefined
        ? page < data.totalPages
        : items.length >= params.pageSize,
  };
}

export async function followUser(
  followUserId: string,
  token: string,
): Promise<UserFollowState> {
  const data = await request<ApiFollowState>("/client/v1/userFollow/follow", {
    method: "POST",
    token,
    body: { followUserId },
  });
  return mapFollowState(data);
}

export async function unfollowUser(
  followUserId: string,
  token: string,
): Promise<UserFollowState> {
  const data = await request<ApiFollowState>("/client/v1/userFollow/unfollow", {
    method: "POST",
    token,
    body: { followUserId },
  });
  return mapFollowState(data);
}
