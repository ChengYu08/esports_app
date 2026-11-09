import { apiClient } from "@/core/network/api-client";
import {
  unwrap,
  type CircleApiResponse,
} from "@/features/circle/circle.api";

const COMMENT_PAGE_SIZE = 10;

/** 评论区评论项（一级/二级通用），字段为后端 CommentVO 的防御性映射。 */
export type CircleComment = {
  id: string;
  userId?: string;
  nickname: string;
  avatar: number | { uri: string };
  content: string;
  likeCount: number;
  liked: boolean;
  /** 发布时间描述，如“昨天 20:10”。 */
  publishTime: string;
  /** IP 属地，如“山东”。 */
  ipLocation?: string;
  /** 是否楼主（视频作者）。 */
  isAuthor: boolean;
  /** 楼主赞过该评论。 */
  authorLiked: boolean;
  /** 已删除的一级评论仍占位展示。 */
  deleted: boolean;
  /** 回复二级评论时被回复的用户昵称。 */
  replyNickname?: string;
  replies: CircleComment[];
};

export type CircleCommentPage = {
  list: CircleComment[];
  nextCursor: string | null;
  hasMore: boolean;
};

/** CommentVO 后端字段名未定型，多种候选形状都做映射。 */
type ApiCircleComment = {
  commentId?: string | number;
  id?: string | number;
  userId?: string | number;
  userInfo?: { id?: string | number; nickname?: string; headImage?: string };
  nickname?: string;
  headImage?: string;
  content?: string;
  likeCount?: number;
  liked?: boolean;
  publishTime?: string;
  createTime?: string;
  ipLocation?: string;
  ipTerritory?: string;
  isAuthor?: boolean;
  authorFlag?: boolean;
  authorLiked?: boolean;
  authorLike?: boolean;
  status?: string;
  replyNickname?: string;
  childComments?: ApiCircleComment[];
};

const FALLBACK_AVATAR = require("../../../assets/images/radar-avatar-1.png");

function toCircleComment(item: ApiCircleComment): CircleComment {
  const id = String(item.commentId ?? item.id ?? "");
  const nickname = item.userInfo?.nickname ?? item.nickname ?? "";
  const headImage = item.userInfo?.headImage ?? item.headImage;
  const location = item.ipLocation ?? item.ipTerritory;
  const time = item.publishTime ?? item.createTime ?? "";
  return {
    id,
    userId:
      item.userInfo?.id != null
        ? String(item.userInfo.id)
        : item.userId != null
          ? String(item.userId)
          : undefined,
    nickname: nickname || "盼友",
    avatar: headImage ? { uri: headImage } : FALLBACK_AVATAR,
    content: item.content ?? "",
    likeCount: item.likeCount ?? 0,
    liked: item.liked ?? false,
    publishTime: time,
    ipLocation: location && location !== "未知" ? location : undefined,
    isAuthor: Boolean(item.isAuthor ?? item.authorFlag),
    authorLiked: Boolean(item.authorLiked ?? item.authorLike),
    deleted: (item.status ?? "").toUpperCase() === "DELETED",
    replyNickname: item.replyNickname || undefined,
    replies: (item.childComments ?? []).map(toCircleComment),
  };
}

type ApiCursorPage<T> = {
  list?: T[];
  nextCursor?: string | null;
  hasMore?: boolean;
};

export async function fetchCircleCommentPage({
  videoId,
  cursor,
  token,
  signal,
}: {
  videoId: string;
  cursor: string | null;
  token?: string;
  signal?: AbortSignal;
}): Promise<CircleCommentPage> {
  const response = await apiClient<CircleApiResponse<ApiCursorPage<ApiCircleComment>>>(
    "/client/v1/moments/comment/list",
    {
      method: "POST",
      token,
      signal,
      body: { videoId, parentCommentId: "", cursor: cursor ?? "", size: COMMENT_PAGE_SIZE },
    },
  );
  const data = unwrap(response, "评论加载失败");
  return {
    list: (data.list ?? []).map(toCircleComment),
    nextCursor: data.nextCursor ?? null,
    hasMore: data.hasMore ?? false,
  };
}

export async function setCircleCommentLiked({
  commentId,
  liked,
  token,
}: {
  commentId: string;
  liked: boolean;
  token: string;
}): Promise<boolean> {
  const response = await apiClient<CircleApiResponse<{ liked: boolean }>>(
    "/client/v1/moments/comment/like",
    { method: "POST", token, body: { commentId, liked } },
  );
  const data = unwrap(response, "点赞操作失败");
  return data.liked;
}

/** 发布评论：回复一级传 parentCommentId，回复二级再带 replyCommentId。 */
export async function publishCircleComment({
  videoId,
  content,
  parentCommentId,
  replyCommentId,
  mentionUserIds,
  token,
}: {
  videoId: string;
  content: string;
  parentCommentId?: string;
  replyCommentId?: string;
  mentionUserIds?: string[];
  token: string;
}): Promise<CircleComment> {
  const response = await apiClient<CircleApiResponse<ApiCircleComment>>(
    "/client/v1/moments/comment/publish",
    {
      method: "POST",
      token,
      body: {
        videoId,
        parentCommentId: parentCommentId ?? "",
        replyCommentId: replyCommentId ?? "",
        content,
        mentionUserIds: mentionUserIds ?? [],
      },
    },
  );
  const data = unwrap(response, "评论发布失败");
  return toCircleComment(data);
}
