import { apiClient } from "@/core/network/api-client";
import { followUser, unfollowUser } from "@/features/mine/api/user-follow.api";
import { formatRelativeTime } from "@/shared/time/relative-time";
import type { CircleFeedKind, CircleVideoPost } from "@/features/circle/circle-data";

const FEED_PAGE_SIZE = 10;

export type CircleApiResponse<T> = {
  code: string;
  info?: string;
  data?: T;
};

type CircleFeedItem = {
  videoId: string | number;
  authorInfo?: { id?: string | number; nickname?: string; headImage?: string };
  title?: string;
  content?: string;
  coverUrl?: string;
  url?: string;
  /** 后端控制播放器源类型；HLS 地址需要使用 .m3u8 后缀以便原生播放器识别。 */
  streamType?: "hls" | "mp4" | string;
  duration?: number;
  declaration?: string[];
  publishTime?: string;
  likeCount?: number;
  commentCount?: number;
  playCount?: number;
  liked?: boolean;
  followed?: boolean;
  topics?: Record<string, string>;
};

export type CircleFeedPage = {
  list: CircleVideoPost[];
  nextCursor: string | null;
  hasMore: boolean;
};

type ApiCursorPage<T> = {
  list?: T[];
  nextCursor?: string | null;
  hasMore?: boolean;
};

export function unwrap<T>(response: CircleApiResponse<T>, fallback: string): T {
  if (response.code !== "SUCCESS" || response.data === undefined) {
    throw new Error(response.info || fallback);
  }
  return response.data;
}

function toCirclePost(item: CircleFeedItem): CircleVideoPost {
  const topicNames = Object.values(item.topics ?? {});
  const content = item.content || "";
  const title = item.title || "";
  return {
    id: String(item.videoId),
    videoUrl: item.url ?? "",
    videoSourceType: item.streamType?.toLowerCase() === "hls" ? "m3u8" : "mp4",
    cover: item.coverUrl ? { uri: item.coverUrl } : require("../../../assets/images/bg_publish_dark.webp"),
    avatar: item.authorInfo?.headImage
      ? { uri: item.authorInfo.headImage }
      : require("../../../assets/images/radar-avatar-1.png"),
    author: item.authorInfo?.nickname || "盼友",
    authorId: item.authorInfo?.id ? String(item.authorInfo.id) : undefined,
    orderEnabled: false,
    headline: content && title ? title : undefined,
    content: content || title,
    tags: topicNames.map((name) => `#${name}`),
    publishedAt: formatRelativeTime(item.publishTime),
    likeCount: item.likeCount ?? 0,
    commentCount: item.commentCount ?? 0,
    liked: item.liked ?? false,
    followed: item.followed ?? false,
  };
}

export async function fetchCircleFeedPage({
  kind,
  cursor,
  token,
  signal,
}: {
  kind: CircleFeedKind;
  cursor: string | null;
  token?: string;
  signal?: AbortSignal;
}): Promise<CircleFeedPage> {
  const response = await apiClient<CircleApiResponse<ApiCursorPage<CircleFeedItem>>>(
    "/client/v1/moments/video/feedList",
    {
      method: "POST",
      token,
      signal,
      body: { tab: kind, cursor: cursor ?? "", size: FEED_PAGE_SIZE },
    },
  );
  const data = unwrap(response, "盼友圈加载失败");
  return {
    list: (data.list ?? []).filter((item) => Boolean(item.url)).map(toCirclePost),
    nextCursor: data.nextCursor ?? null,
    hasMore: data.hasMore ?? false,
  };
}

export async function setCircleVideoLiked({
  videoId,
  liked,
  token,
}: {
  videoId: string;
  liked: boolean;
  token: string;
}): Promise<boolean> {
  const response = await apiClient<CircleApiResponse<{ liked: boolean }>>(
    "/client/v1/moments/video/like",
    { method: "POST", token, body: { videoId, liked } },
  );
  const data = unwrap(response, "点赞操作失败");
  return data.liked;
}

/** 关注/取关视频作者，复用用户关系接口。 */
export async function setCircleAuthorFollowed({
  authorId,
  followed,
  token,
}: {
  authorId: string;
  followed: boolean;
  token: string;
}): Promise<boolean> {
  const state = await (followed ? followUser : unfollowUser)(authorId, token);
  return state.followed;
}

/** C 端热榜话题（运营配置，无热度字段），对齐 PC useCommunityTopic。 */
export type CircleHotTopic = {
  topicId: string;
  topicName: string;
  sort: number;
};

type ApiHotRankTopic = {
  topicId?: string | number;
  topicName?: string;
  sort?: number;
};

/** 热榜免鉴权；失败或空榜返回空数组，前端空态兜底。 */
export async function fetchCircleHotTopics(signal?: AbortSignal): Promise<CircleHotTopic[]> {
  const response = await apiClient<CircleApiResponse<ApiHotRankTopic[]>>(
    "/client/v1/moments/topic/hotRank/list",
    { method: "GET", signal },
  );
  if (response.code !== "SUCCESS" || !Array.isArray(response.data)) {
    return [];
  }
  return response.data
    .filter((item) => item.topicName)
    .map((item) => ({
      topicId: String(item.topicId ?? ""),
      topicName: item.topicName ?? "",
      sort: item.sort ?? 0,
    }))
    .sort((a, b) => a.sort - b.sort);
}

/** 关键词/话题搜索，对齐后端 moments/video/search：keywordType=1 话题精确，缺省跨字段模糊。 */
export async function fetchCircleSearchPage({
  keyword,
  keywordType,
  cursor,
  token,
  signal,
}: {
  keyword: string;
  keywordType?: 1;
  cursor: string | null;
  token?: string;
  signal?: AbortSignal;
}): Promise<CircleFeedPage> {
  const response = await apiClient<CircleApiResponse<ApiCursorPage<CircleFeedItem>>>(
    "/client/v1/moments/video/search",
    {
      method: "POST",
      token,
      signal,
      body: {
        keyword,
        keywordType: keywordType ?? "",
        cursor: cursor ?? "",
        size: FEED_PAGE_SIZE,
      },
    },
  );
  const data = unwrap(response, "搜索失败");
  return {
    list: (data.list ?? []).filter((item) => Boolean(item.url)).map(toCirclePost),
    nextCursor: data.nextCursor ?? null,
    hasMore: data.hasMore ?? false,
  };
}

/** 播放上报按产品约定静默失败，不触发登录/实名流程。 */
export async function reportCircleVideoPlay({
  videoId,
  durationMs,
  token,
}: {
  videoId: string;
  durationMs: number;
  token: string;
}): Promise<void> {
  try {
    await apiClient<CircleApiResponse<unknown>>("/client/v1/moments/video/playReport", {
      method: "POST",
      token,
      skipAuthSideEffects: true,
      body: { videoId, durationMs },
    });
  } catch {
    // 播放统计是弱依赖，网络或鉴权失败不影响视频体验。
  }
}
