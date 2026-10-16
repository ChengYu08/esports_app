import { env } from '@/core/config/env';
import { logger } from '@/core/logging/logger';

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

export type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  timeoutMs?: number;
  /** C 端业务 token，后端约定请求头名称为 `token`。 */
  token?: string;
};

export async function apiClient<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 15_000);
  const startedAt = Date.now();

  try {
    const { token, timeoutMs: _timeoutMs, ...requestOptions } = options;
    const response = await fetch(`${env.apiBaseUrl}${path}`, {
      ...requestOptions,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(token ? { token } : {}),
        ...options.headers,
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const payload = (await response.json().catch(() => null)) as { info?: string; message?: string; code?: string } | T | null;
    logger.debug('api.request', { path, status: response.status, durationMs: Date.now() - startedAt });

    const errorPayload = payload as { info?: string; message?: string; code?: string } | null;
    const requestError = new ApiError(
      errorPayload?.info ?? errorPayload?.message ?? `请求失败，请稍后重试`,
      response.status,
      errorPayload?.code,
    );
    const authExpired = isAuthExpiredResponse(response.status, errorPayload?.code);

    if (authExpired) {
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

    if (!response.ok) throw requestError;
    return payload as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logger.warn('api.network_error', { path, durationMs: Date.now() - startedAt });
    throw new ApiError('网络连接失败，请检查网络后重试', 0);
  } finally {
    clearTimeout(timeout);
  }
}
