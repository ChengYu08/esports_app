import { apiClient, type RequestOptions } from "@/core/network/api-client";

type ApiEnvelope<T> = {
  code?: string;
  info?: string;
  data?: T;
};

/**
 * 无返回值请求：后端 `R<Void>` 成功时 data 为空，仅以 code 判定成功。
 */
async function requestVoid(
  path: string,
  options: RequestOptions,
): Promise<void> {
  const response = await apiClient<ApiEnvelope<unknown>>(path, options);
  if (response.code !== "SUCCESS") {
    throw new Error(response.info || "请求失败");
  }
}

export type SubmitReportParams = {
  reportedUserId: string;
  reason: string;
  description?: string;
};

/** 提交举报（POST /client/v1/userReport/submit）。 */
export async function submitReport(
  params: SubmitReportParams,
  token: string,
): Promise<void> {
  await requestVoid("/client/v1/userReport/submit", {
    method: "POST",
    token,
    body: {
      reportedUserId: params.reportedUserId,
      reason: params.reason,
      description: params.description,
    },
  });
}
