import { ApiError, apiClient } from "@/core/network/api-client";

export type CustomerServiceSession = {
  sessionNo?: string;
  status?: string;
  agentUserId?: string | number;
  imTargetId?: string | number;
  agentNickname?: string;
  agentBadge?: boolean;
  queued?: boolean;
};

type ApiEnvelope<T> = { code?: string; info?: string; data?: T | null };

export const CUSTOMER_SERVICE_BUSY_TEXT = "客服繁忙，请稍后再试";
export const CUSTOMER_SERVICE_TITLE_PREFIX = "【官方客服】";
const BUSY_CODES = new Set([
  "CS_NO_AGENT_ONLINE",
  "CS_AGENT_NOT_FOUND",
  "CS_SESSION_CONFLICT",
]);

export function resolveCustomerServiceError(error: unknown): string {
  if (error instanceof ApiError && error.code && BUSY_CODES.has(error.code)) {
    return CUSTOMER_SERVICE_BUSY_TEXT;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return CUSTOMER_SERVICE_BUSY_TEXT;
}

export async function enterCustomerService(
  token: string,
): Promise<CustomerServiceSession> {
  const response = await apiClient<ApiEnvelope<CustomerServiceSession>>(
    "/client/v1/cs/enter",
    { method: "POST", token, body: {} },
  );
  if (response.code !== "SUCCESS" || !response.data) {
    throw new ApiError(
      response.info || CUSTOMER_SERVICE_BUSY_TEXT,
      200,
      response.code,
    );
  }
  return response.data;
}

export async function touchCustomerServiceSession(
  token: string,
): Promise<void> {
  const response = await apiClient<ApiEnvelope<unknown>>(
    "/client/v1/cs/session/touch",
    { method: "POST", token, body: {} },
  );
  if (response.code !== "SUCCESS") {
    throw new ApiError(
      response.info || CUSTOMER_SERVICE_BUSY_TEXT,
      200,
      response.code,
    );
  }
}

export function createCustomerServiceChatParams(
  session: CustomerServiceSession,
  fallbackNickname?: string,
) {
  const id = String(session.imTargetId ?? session.agentUserId ?? "").trim();
  if (!id) {
    throw new Error("未获取到客服会话目标");
  }
  const nickname =
    (session.agentNickname || fallbackNickname || "客服").trim() || "客服";
  return {
    id,
    title:
      session.agentBadge === false || nickname.startsWith(CUSTOMER_SERVICE_TITLE_PREFIX)
        ? nickname
        : `${CUSTOMER_SERVICE_TITLE_PREFIX}${nickname}`,
    customerService: "1",
  };
}

/** 列表打标后昵称只展示一次：去掉客服入口写入标题的【官方客服】前缀 */
export function stripCustomerServiceTitlePrefix(title: string) {
  return title.startsWith(CUSTOMER_SERVICE_TITLE_PREFIX)
    ? title.slice(CUSTOMER_SERVICE_TITLE_PREFIX.length)
    : title;
}
