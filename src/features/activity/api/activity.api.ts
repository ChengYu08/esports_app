import { apiClient } from "@/core/network/api-client";
import type { ActivityButtonStatus, ActivityDetail, ActivityPublishResult } from "./activity.types";

type ApiEnvelope<T> = { success?: boolean; code?: string; info?: string; data?: T };

type ApiActivityDetail = {
  activityId?: number | string;
  activityCode?: string;
  displayTag?: string | null;
  actionText?: string | null;
  mainTitle?: string;
  subTitle?: string;
  rules?: string;
  startTime?: string;
  endTime?: string;
  serverTime?: string;
  product?: { originalPrice?: number | string | null; activityPrice?: number | string | null; billingUnitName?: string | null } | null;
  stock?: { remainingStock?: number | null } | null;
  buttonStatus?: string;
  disabledReason?: string | null;
};

type ApiActivityPublishResult = {
  requestNo?: string;
  roomId?: number | string | null;
  roomVersion?: number | null;
  expireTime?: string;
};

const BUTTON_STATUSES: readonly ActivityButtonStatus[] = [
  "NOT_STARTED",
  "ACTIVE",
  "SOLD_OUT",
  "ENDED",
  "DISABLED",
];

/** 本项目成功包络可能省略 data（见 joined/current 先例），缺失时兜底抛错。 */
function requireSuccess<T>(response: ApiEnvelope<T | null | undefined>, fallback: string): T {
  if (response.code !== "SUCCESS" || response.data === undefined || response.data === null) {
    throw new Error(response.info || fallback);
  }
  return response.data;
}

/** 宽松转数字：非法/缺失兜底 0。 */
function toNumber(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return parsed;
}

function readButtonStatus(value: unknown): ActivityButtonStatus {
  const text = typeof value === "string" ? value.trim() : "";
  if ((BUTTON_STATUSES as readonly string[]).includes(text)) {
    return text as ActivityButtonStatus;
  }
  return "ACTIVE";
}

/**
 * 秒杀活动详情。公开接口：apiClient 仅在显式传入 token 时携带请求头，
 * 这里不传即满足"未登录不带 token"的约定。
 */
export async function fetchActivityDetail(activityCode: string, signal?: AbortSignal): Promise<ActivityDetail> {
  const response = await apiClient<ApiEnvelope<ApiActivityDetail>>("/client/v1/activity/detail", {
    method: "POST",
    body: { action: { activityCode } },
    signal,
  });
  const data = requireSuccess(response, "活动信息加载失败");
  return {
    activityId: String(data.activityId ?? ""),
    activityCode: (data.activityCode || "").trim(),
    displayTag: (data.displayTag || "").trim() || "活动",
    actionText: (data.actionText || "").trim() || "立即参与",
    mainTitle: (data.mainTitle || "").trim(),
    subTitle: (data.subTitle || "").trim(),
    rules: data.rules || "",
    startTime: (data.startTime || "").trim(),
    endTime: (data.endTime || "").trim(),
    serverTime: (data.serverTime || "").trim(),
    product: {
      originalPrice: toNumber(data.product?.originalPrice),
      activityPrice: toNumber(data.product?.activityPrice),
      billingUnitName: (data.product?.billingUnitName || "").trim(),
    },
    remainingStock: Math.max(0, Math.trunc(toNumber(data.stock?.remainingStock))),
    buttonStatus: readButtonStatus(data.buttonStatus),
    disabledReason: (data.disabledReason || "").trim() || undefined,
  };
}

/** 参与活动：发布活动派单，需登录（token 显式传入）。 */
export async function publishActivity(
  activityId: string,
  token: string,
  signal?: AbortSignal,
): Promise<ActivityPublishResult> {
  const response = await apiClient<ApiEnvelope<ApiActivityPublishResult>>("/client/v1/activity/publish", {
    method: "POST",
    token,
    body: { action: { activityId: Number(activityId) } },
    signal,
    // 未实名由活动进房流弹「去实名」，不走全局自动跳转
    suppressRealNameRedirect: true,
  });
  const data = requireSuccess(response, "参与活动失败");
  if (!(data.requestNo || "").trim()) {
    throw new Error("参与活动失败");
  }
  return {
    requestNo: String(data.requestNo).trim(),
    roomId: data.roomId == null || data.roomId === "" ? null : String(data.roomId),
    roomVersion: data.roomVersion == null ? null : Number(data.roomVersion),
    expireTime: (data.expireTime || "").trim(),
  };
}
