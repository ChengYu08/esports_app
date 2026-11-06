import { isAxiosError, isCancel, type Method } from "axios";

import { logger } from "@/core/logging/logger";

import { apiAxios } from "./axios-instance";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type AuthExpiredHandler = (error: ApiError, requestToken: string) => void | Promise<void>;

let authExpiredHandler: AuthExpiredHandler | null = null;

const AUTH_EXPIRED_CODES = new Set([
  '401',
  'UNAUTHORIZED',
  'NOT_LOGIN',
  'NOT_LOGGED_IN',
]);

const AUTH_EXPIRY_IGNORED_PATHS = ['/client/v1/user/logout'];

export function setAuthExpiredHandler(handler: AuthExpiredHandler | null) {
  authExpiredHandler = handler;
  return () => {
    if (authExpiredHandler === handler) authExpiredHandler = null;
  };
}

function isAuthExpiredResponse(status: number, code?: string): boolean {
  return status === 401 || AUTH_EXPIRED_CODES.has(String(code ?? '').toUpperCase());
}

// ─── 全局「未进行实名认证」拦截 ────────────────────────────────────────

type RealNameRequiredHandler = () => void | Promise<void>;

let realNameRequiredHandler: RealNameRequiredHandler | null = null;
let lastRealNameTriggeredAt = 0;

/** 未实名完整文案（后端 BussinessException 的 info 文本，精确匹配；避免误命中「老板未进行实名认证」等） */
const REAL_NAME_REQUIRED_MESSAGE = '未进行实名认证';
/** 连续多个接口同时未实名失败时的引导冷却，避免重复压入实名页 */
const REAL_NAME_TRIGGER_COOLDOWN_MS = 3000;

export function setRealNameRequiredHandler(handler: RealNameRequiredHandler | null) {
  realNameRequiredHandler = handler;
  return () => {
    if (realNameRequiredHandler === handler) realNameRequiredHandler = null;
  };
}

async function triggerRealNameRequiredIfNeed(payload: ResponseErrorPayload): Promise<void> {
  if (!payload || payload.code === 'SUCCESS') return;
  const info = payload.info ?? payload.message;
  if (info !== REAL_NAME_REQUIRED_MESSAGE) return;
  const now = Date.now();
  if (now - lastRealNameTriggeredAt < REAL_NAME_TRIGGER_COOLDOWN_MS) return;
  lastRealNameTriggeredAt = now;
  try {
    await realNameRequiredHandler?.();
  } catch {
    logger.warn('api.real_name_handler_error', {});
  }
}

type ResponseErrorPayload = { info?: string; message?: string; code?: string } | null;

function readErrorPayload(payload: unknown): ResponseErrorPayload {
  if (!payload || typeof payload !== 'object') return null;
  return payload as ResponseErrorPayload;
}

async function processResponse<T>(
  path: string,
  status: number,
  payload: unknown,
  token?: string,
  suppressRealNameRedirect?: boolean,
): Promise<T> {
  const errorPayload = readErrorPayload(payload);
  const requestError = new ApiError(
    errorPayload?.info ?? errorPayload?.message ?? `请求失败，请稍后重试`,
    status,
    errorPayload?.code,
  );

  if (isAuthExpiredResponse(status, errorPayload?.code)) {
    const shouldHandleAuthExpiry = Boolean(token)
      && !AUTH_EXPIRY_IGNORED_PATHS.some((ignoredPath) => path.includes(ignoredPath));
    if (shouldHandleAuthExpiry) {
      try {
        await authExpiredHandler?.(requestError, token!);
      } catch {
        logger.warn('api.auth_expiry_handler_error', { path });
      }
    }
    throw requestError;
  }

  // 全局「未进行实名认证」拦截：info 精确命中时引导去实名（对齐 Web 端行为），错误仍正常抛出。
  // 调用方声明 suppressRealNameRedirect 时改由其在弹窗中自行引导（如「去实名」按钮）
  if (!suppressRealNameRedirect) {
    await triggerRealNameRequiredIfNeed(errorPayload);
  }
  if (status < 200 || status >= 300) throw requestError;
  return payload as T;
}

export type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  timeoutMs?: number;
  /** C 端业务 token，后端约定请求头名称为 `token`。 */
  token?: string;
  /** 命中「未进行实名认证」时不做全局自动跳转，由调用方在失败弹窗中自行引导去实名。 */
  suppressRealNameRedirect?: boolean;
};

export async function apiClient<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { token, timeoutMs, body, method, suppressRealNameRedirect } = options;
  const startedAt = Date.now();

  try {
    const response = await apiAxios.request<T>({
      url: path,
      method: (method as Method | undefined) ?? 'GET',
      data: body === undefined ? undefined : JSON.stringify(body),
      headers: {
        ...(token ? { token } : {}),
        ...(options.headers as Record<string, string> | undefined),
      },
      timeout: timeoutMs,
      signal: options.signal ?? undefined,
    });
    logger.debug('api.request', { path, status: response.status, durationMs: Date.now() - startedAt });
    return await processResponse<T>(path, response.status, response.data, token, suppressRealNameRedirect);
  } catch (error) {
    // React Query 取消请求时原样抛出，不当作网络失败。
    if (isCancel(error)) throw error;
    if (error instanceof ApiError) throw error;

    if (isAxiosError(error) && error.response) {
      logger.debug('api.request', { path, status: error.response.status, durationMs: Date.now() - startedAt });
      return await processResponse<T>(path, error.response.status, error.response.data, token, suppressRealNameRedirect);
    }

    logger.warn('api.network_error', { path, durationMs: Date.now() - startedAt });
    throw new ApiError('网络连接失败，请检查网络后重试', 0);
  }
}
