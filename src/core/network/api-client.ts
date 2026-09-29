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
    const payload = (await response.json().catch(() => null)) as { message?: string; code?: string } | T | null;
    logger.debug('api.request', { path, status: response.status, durationMs: Date.now() - startedAt });

    if (!response.ok) {
      const errorPayload = payload as { message?: string; code?: string } | null;
      throw new ApiError(errorPayload?.message ?? '请求失败，请稍后重试', response.status, errorPayload?.code);
    }
    return payload as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logger.warn('api.network_error', { path, durationMs: Date.now() - startedAt });
    throw new ApiError('网络连接失败，请检查网络后重试', 0);
  } finally {
    clearTimeout(timeout);
  }
}
