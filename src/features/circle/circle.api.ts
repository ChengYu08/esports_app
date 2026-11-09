import { apiClient } from "@/core/network/api-client";
import { followUser, unfollowUser } from "@/features/mine/api/user-follow.api";
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
    publishedAt: item.publishTime || "",
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
