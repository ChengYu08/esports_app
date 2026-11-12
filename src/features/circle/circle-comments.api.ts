import { apiClient } from "@/core/network/api-client";
import {
  unwrap,
  type CircleApiResponse,
} from "@/features/circle/circle.api";
import type { CircleContentRef } from "@/features/circle/circle-publish.api";
import { formatRelativeTime } from "@/shared/time/relative-time";

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
  /** 正文中的 @用户 引用（带位置优先，字典为 id→昵称）。 */
  mentions?: CircleContentRef[] | Record<string, string>;
  replies: CircleComment[];
};

export type CircleCommentPage = {
  list: CircleComment[];
  nextCursor: string | null;
  hasMore: boolean;
  /** 评论总数（后端游标页 total 字段）；空表示未返回，回退到 feed 的 commentCount。 */
  total?: number | null;
};

/** CommentVO 后端字段名未定型，多种候选形状都做映射。 */
type ApiCircleUser = { id?: string | number; userId?: string | number; nickname?: string; headImage?: string };

type ApiCircleComment = {
  commentId?: string | number;
  id?: string | number;
  userId?: string | number;
  /** 后端 CommentVO 实际字段：评论人信息。 */
  authorInfo?: ApiCircleUser;
  /** 后端 CommentVO 实际字段：被回复人信息（二级评论）。 */
  targetAuthorInfo?: ApiCircleUser;
  userInfo?: ApiCircleUser;
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
  /** 后端 CommentVO.mentionRefs：@用户 实体（带位置）。 */
  mentionRefs?: CircleContentRef[];
  /** 后端兜底：@用户 id→昵称 字典（无位置时推导）。 */
  mentionUsers?: Record<string, string>;
  childComments?: ApiCircleComment[];
};

const FALLBACK_AVATAR = require("../../../assets/images/radar-avatar-1.png");

function toCircleComment(item: ApiCircleComment): CircleComment {
  const id = String(item.commentId ?? item.id ?? "");
  const author = item.authorInfo ?? item.userInfo;
  const userId = item.userId ?? author?.userId ?? author?.id;
  const nickname = author?.nickname ?? item.nickname ?? "";
  const headImage = author?.headImage ?? item.headImage;
  const location = item.ipLocation ?? item.ipTerritory;
  const time = item.publishTime ?? item.createTime ?? "";
  return {
    id,
    userId: userId != null ? String(userId) : undefined,
    nickname: nickname || "盼友",
    avatar: headImage ? { uri: headImage } : FALLBACK_AVATAR,
    content: item.content ?? "",
    likeCount: item.likeCount ?? 0,
    liked: item.liked ?? false,
    publishTime: formatRelativeTime(time),
    ipLocation: location && location !== "未知" ? location : undefined,
    isAuthor: Boolean(item.isAuthor ?? item.authorFlag),
    authorLiked: Boolean(item.authorLiked ?? item.authorLike),
    deleted: (item.status ?? "").toUpperCase() === "DELETED",
    replyNickname: (item.replyNickname ?? item.targetAuthorInfo?.nickname) || undefined,
    mentions: item.mentionRefs?.length ? item.mentionRefs : item.mentionUsers,
    replies: (item.childComments ?? []).map(toCircleComment),
  };
}

type ApiCursorPage<T> = {
  list?: T[];
  nextCursor?: string | null;
  hasMore?: boolean;
  total?: number | null;
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
    total: data.total ?? null,
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

/** 举报类型枚举项（后端 Nacos 配置下发，对齐 PC 的 ReportTypeVO）。 */
export type CircleCommentReportType = {
  code: string;
  name: string;
  desc?: string;
};

/** 举报类型列表免鉴权（@IgnoreToken）；失败或空返回空数组兜底。 */
export async function fetchCircleCommentReportTypes(
  signal?: AbortSignal,
): Promise<CircleCommentReportType[]> {
  const response = await apiClient<CircleApiResponse<CircleCommentReportType[]>>(
    "/client/v1/moments/comment/reportType/list",
    { method: "GET", signal },
  );
  if (response.code !== "SUCCESS" || !Array.isArray(response.data)) {
    return [];
  }
  return response.data.filter((item) => item.code && item.name);
}

/** 提交评论举报，对齐 PC：commentId + reportType，补充说明选填。 */
export async function reportCircleComment({
  commentId,
  reportType,
  reportDesc,
  token,
}: {
  commentId: string;
  reportType: string;
  reportDesc?: string;
  token: string;
}): Promise<void> {
  const response = await apiClient<CircleApiResponse<unknown>>(
    "/client/v1/moments/comment/report",
    {
      method: "POST",
      token,
      body: {
        commentId,
        reportType,
        ...(reportDesc?.trim() ? { reportDesc: reportDesc.trim() } : {}),
      },
    },
  );
  // R<Void> 成功时 data 为空，仅以 code 判定成功
  if (response.code !== "SUCCESS") {
    throw new Error(response.info || "举报提交失败");
  }
}

/** 发布评论：回复一级传 parentCommentId，回复二级再带 replyCommentId。 */
export async function publishCircleComment({
  videoId,
  content,
  parentCommentId,
  replyCommentId,
  mentionUserIds,
  mentions,
  token,
}: {
  videoId: string;
  content: string;
  parentCommentId?: string;
  replyCommentId?: string;
  mentionUserIds?: string[];
  mentions?: CircleContentRef[];
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
        mentions: mentions ?? [],
      },
    },
  );
  const data = unwrap(response, "评论发布失败");
  return toCircleComment(data);
}
