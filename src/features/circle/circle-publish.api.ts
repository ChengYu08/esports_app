import { apiClient } from "@/core/network/api-client";
import { unwrap, type CircleApiResponse } from "@/features/circle/circle.api";

/** 后端 /client/v1/media/video/uploadSign 签发的火山 VOD 直传凭证。 */
export type VodUploadSign = {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  /** 凭证过期时间（ISO） */
  expiredTime: string;
  /** 服务端当前时间（ISO），签名 X-Date 优先用它避免设备时钟偏差 */
  currentTime: string;
  /** 视频处理模板 id（CommitUploadInfo 的 StartWorkflow 用） */
  handlerTemplateId?: string;
  spaceName: string;
  /** 后端生成的对象 key（含后缀） */
  filename: string;
  appId?: number;
};

/** 获取视频直传凭证（业务 token 认证）。 */
export async function fetchCircleUploadSign({
  filename,
  token,
}: {
  filename: string;
  token: string;
}): Promise<VodUploadSign> {
  const response = await apiClient<CircleApiResponse<VodUploadSign>>(
    "/client/v1/media/video/uploadSign",
    { method: "POST", token, body: { filename } },
  );
  return unwrap(response, "获取上传凭证失败");
}

/** 发布选话题选项（/client/v1/moments/topic/list）。 */
export type CircleTopicOption = {
  topicId: string;
  topicName: string;
};

/** 空关键词=热榜前 N，非空=模糊匹配前 N（后端约定 mode=default）。 */
export async function fetchCircleTopicOptions({
  keyword,
  signal,
}: {
  keyword: string;
  signal?: AbortSignal;
}): Promise<CircleTopicOption[]> {
  const response = await apiClient<CircleApiResponse<{ topicId?: number | string; topicName?: string }[]>>(
    `/client/v1/moments/topic/list?keyword=${encodeURIComponent(keyword)}&mode=default`,
    { method: "GET", signal },
  );
  const data = unwrap(response, "话题加载失败");
  return data
    .filter((item) => item.topicName)
    .map((item) => ({
      topicId: String(item.topicId ?? ""),
      topicName: item.topicName ?? "",
    }));
}

/** 自主声明选项（Nacos 配置下发，code 即展示文案）。 */
export async function fetchCircleDeclarations(signal?: AbortSignal): Promise<string[]> {
  const response = await apiClient<CircleApiResponse<{ code?: string; name?: string }[]>>(
    "/client/v1/moments/video/declaration/list",
    { method: "GET", signal },
  );
  const data = unwrap(response, "自主声明加载失败");
  return data.map((item) => item.name ?? item.code ?? "").filter(Boolean);
}

/** 正文中的话题/@用户引用（后端 MomentsVideoContentRefVO 契约，码点偏移）。 */
export type CircleContentRef = {
  id: string;
  label: string;
  offset: number;
  length: number;
};

export async function publishCircleVideo({
  vid,
  title,
  content,
  topics,
  mentions,
  declarations,
  token,
}: {
  vid: string;
  title: string;
  content: string;
  topics: CircleContentRef[];
  mentions: CircleContentRef[];
  declarations: string[];
  token: string;
}): Promise<void> {
  const response = await apiClient<CircleApiResponse<unknown>>(
    "/client/v1/moments/video/publish",
    {
      method: "POST",
      token,
      body: { vid, title, content, topics, mentions, declarations },
    },
  );
  unwrap(response, "发布失败，请重试");
}
