import { createSignature } from "./signature";
import { SsoError } from "./types";
import type { QuickLoginAuthToken, QuickLoginProvider, SsoClientConfig, SsoRequestOptions, SsoToken } from "./types";

export class SsoClient {
  private readonly config: SsoClientConfig;
  private readonly fetcher: typeof globalThis.fetch;

  constructor(config: SsoClientConfig) {
    this.config = {
      ...config,
      baseUrl: config.baseUrl.replace(/\/$/, ""),
      sourceType: config.sourceType ?? (config.os === "iOS" ? "GUHAO_IOS" : "GUHAO_ANDROID"),
    };
    this.fetcher = config.fetch ?? globalThis.fetch.bind(globalThis);
  }

  async request<T = unknown>(path: string, options: SsoRequestOptions = {}): Promise<T> {
    const method = options.method ?? "POST";
    const data = { ...(options.data ?? {}), sourceType: this.config.sourceType };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 15_000);
    try {
      const headers = { ...createSignature(data, method, this.config), AUTHORIZATION: `basic ${this.config.clientSecret}`, ...(options.headers ?? {}) };
      const requestUrl = method === "GET"
        ? `${this.config.baseUrl}${path}${path.includes("?") ? "&" : "?"}${new URLSearchParams(Object.entries(data).map(([key, value]) => [key, String(value)]))}`
        : `${this.config.baseUrl}${path}`;
      const response = await this.fetcher(requestUrl, { method, headers, signal: controller.signal, body: method === "GET" ? undefined : JSON.stringify(data) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new SsoError(body?.info ?? body?.message ?? `请求失败: ${response.status}`, response.status, body?.code);
      if (path.includes("/oauth2/token")) {
        if (!body?.access_token) throw new SsoError(body?.info ?? body?.message ?? "获取 token 失败", response.status, body?.code);
        return body as T;
      }
      if (options.skipCodeCheck || body?.code === "SUCCESS") return body as T;
      throw new SsoError(body?.info ?? body?.message ?? "请求失败", response.status, body?.code);
    } finally { clearTimeout(timeout); }
  }

  getSmsCode(phone: string, smsTemplate: "LOGIN" | "MOD" | "REGISTER" = "LOGIN") {
    return this.request("/api/auth/public/common/sms", { data: { phone, smsTemplate } });
  }
  smsLogin(phone: string, code: string) {
    return this.request<SsoToken>("/api/auth/oauth2/token", { data: { grant_type: "mobile", phone, code, scope: "openid" } });
  }
  passwordLogin(username: string, password: string) {
    return this.request<SsoToken>("/api/auth/oauth2/token", { data: { grant_type: "password", username, password, scope: "openid" } });
  }
  refreshToken(refreshToken: string) {
    return this.request<SsoToken>("/api/auth/oauth2/token", { data: { grant_type: "refresh_token", refresh_token: refreshToken, scope: "openid" } });
  }
  logout(accessToken: string) {
    return this.request("/api/auth/token/logout", { headers: { AUTHORIZATION: `Bearer ${accessToken}` } });
  }

  async getQuickLoginAuthToken(): Promise<QuickLoginAuthToken> {
    const body = await this.request<{ data?: QuickLoginAuthToken }>("/api/auth/public/ali/h5/one-key/auth-token", { method: "GET", skipCodeCheck: true });
    const token = body.data ?? (body as unknown as QuickLoginAuthToken);
    if (!token.jwtToken || !token.accessToken) throw new SsoError("一键登录鉴权 token 不完整");
    return token;
  }

  async quickLogin(provider: QuickLoginProvider): Promise<SsoToken & { phone?: string }> {
    const authToken = await this.getQuickLoginAuthToken();
    if (!(await provider.checkLoginAvailable(authToken))) throw new SsoError("当前环境不支持一键登录");
    const result = await provider.getLoginToken(authToken);
    if (!result.spToken) throw new SsoError("一键登录未返回授权 token");
    return this.request<SsoToken & { phone?: string }>("/api/auth/oauth2/token", { data: { code: result.spToken, grant_type: "ali_h5_one_key", scope: "openid" } });
  }
}
