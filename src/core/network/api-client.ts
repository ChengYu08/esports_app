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

  if (status < 200 || status >= 300) throw requestError;
  return payload as T;
}

export type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  timeoutMs?: number;
  /** C 端业务 token，后端约定请求头名称为 `token`。 */
  token?: string;
};

export async function apiClient<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { token, timeoutMs, body, method } = options;
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
    return await processResponse<T>(path, response.status, response.data, token);
  } catch (error) {
    // React Query 取消请求时原样抛出，不当作网络失败。
    if (isCancel(error)) throw error;
    if (error instanceof ApiError) throw error;

    if (isAxiosError(error) && error.response) {
      logger.debug('api.request', { path, status: error.response.status, durationMs: Date.now() - startedAt });
      return await processResponse<T>(path, error.response.status, error.response.data, token);
    }

    logger.warn('api.network_error', { path, durationMs: Date.now() - startedAt });
    throw new ApiError('网络连接失败，请检查网络后重试', 0);
  }
}
