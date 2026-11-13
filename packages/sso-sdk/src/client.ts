import axios, { isAxiosError } from "axios";

import {
  createForgetPasswordRequest,
  createPasswordLoginRequest,
} from "./password-requests";
import { createSignature } from "./signature";
import type {
  QuickLoginAuthToken,
  QuickLoginProvider,
  SsoClientConfig,
  SsoRequestLog,
  SsoRequestOptions,
  SsoToken,
} from "./types";
import { QuickLoginCancelledError, SsoError } from "./types";

export class SsoClient {
  private readonly config: SsoClientConfig;
  private readonly referer: string;
  private readonly axiosInstance: ReturnType<typeof axios.create>;
  /** 服务器时间偏移（毫秒），模块级缓存；签名要求 PZTimestamp 接近服务端时间，安卓设备时钟不准会被签名校验拒绝 */
  private timeDiffMs: number | null = null;
  private timeDiffPromise: Promise<void> | null = null;

  constructor(config: SsoClientConfig) {
    this.config = {
      ...config,
      baseUrl: config.baseUrl.replace(/\/$/, ""),
      sourceType:
        config.sourceType ??
        (config.os === "iOS" ? "dianjing-ios" : "dianjing-android"),
    };
    const defaultReferer =
      this.config.os === "iOS"
        ? "https://djpc.jlgkj.top"
        : "https://dj.panzhi.com";
    // 后端风控白名单要求 Android 的 Referer 带尾斜杠，iOS 不带
    this.referer =
      this.config.referer ??
      (this.config.os === "iOS" ? defaultReferer : `${defaultReferer}/`);
    this.axiosInstance = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeoutMs ?? 15_000,
    });
  }

  /** 与服务器时间对齐：只同步一次并缓存偏移，失败时回退本地时间（对齐 PC apiClient 的 getTimestamp） */
  private async getTimestamp(): Promise<number> {
    if (this.timeDiffMs !== null) {
      return Date.now() + this.timeDiffMs;
    }
    if (!this.timeDiffPromise) {
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout>;
      // 时间同步发生在业务请求超时计时之前，必须独立限时，且覆盖响应体读取。
      const deadline = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error("服务器时间同步超时"));
          controller.abort();
        }, Math.min(this.config.timeoutMs ?? 5_000, 5_000));
      });
      const response = fetch(`${this.config.baseUrl}/api/server/time`, {
        signal: controller.signal,
      }).then((res) => res.json());
      this.timeDiffPromise = Promise.race([response, deadline])
        .then((data) => {
          const serverTime = data?.data;
          this.timeDiffMs =
            typeof serverTime === "number" ? serverTime - Date.now() : 0;
        })
        .catch(() => {
          this.timeDiffMs = 0;
        })
        .finally(() => {
          clearTimeout(timer);
        });
    }
    await this.timeDiffPromise;
    return Date.now() + (this.timeDiffMs ?? 0);
  }

  async request<T = unknown>(
    path: string,
    options: SsoRequestOptions = {},
  ): Promise<T> {
    const method = options.method ?? "POST";
    const data = {
      ...(options.data ?? {}),
      sourceType: this.config.sourceType,
    };
    const startedAt = Date.now();
    const log = (
      event: Omit<SsoRequestLog, "method" | "path" | "durationMs">,
    ) => {
      this.config.onRequestLog?.({
        method,
        path,
        durationMs: Date.now() - startedAt,
        ...event,
      });
    };
    const timestamp = await this.getTimestamp();
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.config.timeoutMs ?? 15_000,
    );

    const parseBody = (
      raw: unknown,
    ): Record<string, unknown> | null | undefined => {
      if (raw === undefined || raw === null || raw === "") return {};
      if (typeof raw === "string") {
        try {
          return JSON.parse(raw);
        } catch {
          return null;
        }
      }
      if (typeof raw === "object") return raw as Record<string, unknown>;
      return null;
    };
    const readString = (value: unknown): string | undefined =>
      typeof value === "string" ? value : undefined;

    try {
      const headers = {
        ...createSignature(data, method, this.config, timestamp),
        // 必须带 Referer，否则会命中 WAF 被拦截（Android 多一个尾斜杠以匹配风控白名单）
        Referer: this.referer,
        AUTHORIZATION: `basic ${this.config.clientSecret}`,
        ...(options.headers ?? {}),
      };

      const queryParams = new URLSearchParams(
        Object.entries(data).map(([key, value]) => [key, String(value)]),
      );
      const requestUrl =
        method === "GET"
          ? `${path}${path.includes("?") ? "&" : "?"}${queryParams.toString()}`
          : path;

      let status = 0;
      let rawBody: unknown;
      try {
        const response = await this.axiosInstance.request<string>({
          url: requestUrl,
          method,
          headers,
          signal: controller.signal,
          data: method === "GET" ? undefined : JSON.stringify(data),
          responseType: "text",
          transformResponse: [(res) => res],
        });
        status = response.status;
        rawBody = response.data;
      } catch (error) {
        if (isAxiosError(error) && error.response) {
          status = error.response.status;
          rawBody = error.response.data;
        } else {
          throw error;
        }
      }

      const body = parseBody(rawBody);
      log({
        status,
        code: typeof body?.code === "string" ? body.code : undefined,
      });
      if (status < 200 || status >= 300)
        throw new SsoError(
          readString(body?.info) ??
            readString(body?.message) ??
            `请求失败: ${status}`,
          status,
          readString(body?.code),
        );
      if (path.includes("/oauth2/token")) {
        if (!body?.access_token)
          throw new SsoError(
            readString(body?.info) ??
              readString(body?.message) ??
              "获取 token 失败",
            status,
            readString(body?.code),
          );
        return body as T;
      }
      if (options.skipCodeCheck || body?.code === "SUCCESS") return body as T;
      throw new SsoError(
        readString(body?.info) ?? readString(body?.message) ?? "请求失败",
        status,
        readString(body?.code),
      );
    } catch (error) {
      if (!(error instanceof SsoError)) {
        log({ error: error instanceof Error ? error.message : "网络请求失败" });
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  getSmsCode(
    phone: string,
    smsTemplate: "LOGIN" | "MOD" | "REGISTER" = "LOGIN",
  ) {
    return this.request("/api/auth/public/common/sms", {
      data: { phone, smsTemplate },
    });
  }
  smsLogin(phone: string, code: string) {
    return this.request<SsoToken>("/api/auth/oauth2/token", {
      data: { grant_type: "mobile", phone, code, scope: "openid" },
    });
  }
  passwordLogin(username: string, password: string) {
    const request = createPasswordLoginRequest(username, password);
    return this.request<SsoToken>(request.path, { data: request.data });
  }
  forgetPassword(phone: string, smsCode: string, password: string) {
    const request = createForgetPasswordRequest(phone, smsCode, password);
    return this.request(request.path, { data: request.data });
  }
  refreshToken(refreshToken: string) {
    return this.request<SsoToken>("/api/auth/oauth2/token", {
      data: {
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        scope: "openid",
      },
    });
  }
  logout(accessToken: string) {
    return this.request("/api/auth/token/logout", {
      headers: { AUTHORIZATION: `Bearer ${accessToken}` },
    });
  }

  async getQuickLoginAuthToken(): Promise<QuickLoginAuthToken> {
    console.info("[DEBUG-QUICK-LOGIN] requesting SSO auth token");
    const body = await this.request<{ data?: QuickLoginAuthToken }>(
      "/api/auth/public/ali/h5/one-key/auth-token",
      { method: "GET", skipCodeCheck: true },
    );
    const token = body.data ?? (body as unknown as QuickLoginAuthToken);
    if (!token.jwtToken || !token.accessToken) {
      console.warn(
        "[DEBUG-QUICK-LOGIN] SSO auth token response is incomplete",
        {
          hasJwtToken: Boolean(token.jwtToken),
          hasAccessToken: Boolean(token.accessToken),
          bodyKeys:
            body && typeof body === "object" ? Object.keys(body) : typeof body,
          code:
            body && typeof body === "object" && "code" in body
              ? String((body as { code?: unknown }).code)
              : undefined,
          info:
            body && typeof body === "object" && "info" in body
              ? String((body as { info?: unknown }).info)
              : undefined,
        },
      );
      throw new SsoError("一键登录鉴权 token 不完整");
    }
    console.info("[DEBUG-QUICK-LOGIN] SSO auth token received");
    return token;
  }

  /** 只探测当前设备是否支持一键登录，不拉起授权页。 */
  async checkQuickLoginAvailable(
    provider: QuickLoginProvider,
  ): Promise<boolean> {
    const authToken = await this.getQuickLoginAuthToken();
    return provider.checkLoginAvailable(authToken);
  }

  /** 直接拉起运营商授权页完成一键登录（调用前应先确认可用）。 */
  async authorizeQuickLogin(
    provider: QuickLoginProvider,
  ): Promise<SsoToken & { phone?: string }> {
    const authToken = await this.getQuickLoginAuthToken();
    console.info("[DEBUG-QUICK-LOGIN] requesting carrier authorization");
    const result = await provider.getLoginToken(authToken);
    const cancelled = QuickLoginCancelledError.from(result);
    if (cancelled) {
      console.info("[DEBUG-QUICK-LOGIN] carrier authorization cancelled", {
        reason: cancelled.reason,
      });
      throw cancelled;
    }
    console.info("[DEBUG-QUICK-LOGIN] carrier authorization completed", {
      hasSpToken: Boolean(result.spToken),
    });
    if (!result.spToken) throw new SsoError("一键登录未返回授权 token");
    console.info("[DEBUG-QUICK-LOGIN] exchanging carrier token with SSO");
    return this.request<SsoToken & { phone?: string }>(
      "/api/auth/oauth2/token",
      {
        data: {
          code: result.spToken,
          grant_type: "ali_app_one_key",
          scope: "openid",
        },
      },
    );
  }

  async quickLogin(
    provider: QuickLoginProvider,
  ): Promise<SsoToken & { phone?: string }> {
    const authToken = await this.getQuickLoginAuthToken();
    console.info("[DEBUG-QUICK-LOGIN] checking native provider availability");
    const available = await provider.checkLoginAvailable(authToken);
    console.info("[DEBUG-QUICK-LOGIN] native provider availability", {
      available,
    });
    if (!available)
      throw new SsoError("当前设备暂不支持一键登录，请使用验证码登录");
    console.info("[DEBUG-QUICK-LOGIN] requesting carrier authorization");
    const result = await provider.getLoginToken(authToken);
    console.info("[DEBUG-QUICK-LOGIN] carrier authorization completed", {
      hasSpToken: Boolean(result.spToken),
    });
    if (!result.spToken) throw new SsoError("一键登录未返回授权 token");
    console.info("[DEBUG-QUICK-LOGIN] exchanging carrier token with SSO");
    return this.request<SsoToken & { phone?: string }>(
      "/api/auth/oauth2/token",
      {
        data: {
          code: result.spToken,
          grant_type: "ali_app_one_key",
          scope: "openid",
        },
      },
    );
  }
}
