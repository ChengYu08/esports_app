import type { AxiosAdapter } from "axios";

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export type SsoToken = {
  access_token?: string;
  refresh_token: string;
  scope?: string;
  token_type?: string;
  id_token?: string;
  expires_in?: number;
};

export type SsoSourceType = "dianjing-ios" | "dianjing-android";

export type SsoRequestLog = {
  method: HttpMethod;
  path: string;
  status?: number;
  code?: string;
  durationMs: number;
  error?: string;
};

export type SsoClientConfig = {
  baseUrl: string;
  clientAppId: string;
  /** Base64(client_id:raw client_secret), without the Basic prefix. */
  clientSecret: string;
  appVersion?: string;
  os?: "Android" | "iOS" | "Harmony" | "Unknown";
  /** Backend application source identifier sent with every auth request. */
  sourceType?: SsoSourceType;
  /** Referer header sent with every auth request; required, otherwise the request is blocked by WAF. */
  referer?: string;
  /** Optional diagnostic hook. It never receives request bodies or credentials. */
  onRequestLog?: (log: SsoRequestLog) => void;
  /** Optional Axios transport override for host apps and deterministic callers. */
  adapter?: AxiosAdapter;
  timeoutMs?: number;
};

export type SsoRequestOptions = {
  method?: HttpMethod;
  data?: Record<string, unknown>;
  headers?: Record<string, string>;
  skipCodeCheck?: boolean;
};

export type QuickLoginAuthToken = { jwtToken: string; accessToken: string };

/**
 * 授权结果。阿里云 SDK 的 helper 是单例，并发授权时取消回调只会送达到
 * 最后一次注册的监听器，挂起的 promise 拿不到 reject；所以取消不走异常，
 * 用 cancelled 标记把「用户主动退出」作为正常结果一路带回来。
 */
export type QuickLoginAuthorizeResult = {
  spToken?: string;
  phone?: string;
  cancelled?: "switch" | "exit";
};

export type QuickLoginProvider = {
  checkLoginAvailable: (tokens: QuickLoginAuthToken) => Promise<boolean>;
  getLoginToken: (
    tokens: QuickLoginAuthToken,
  ) => Promise<QuickLoginAuthorizeResult>;
  cancel?: () => Promise<void> | void;
};

export class SsoError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "SsoError";
  }
}

/** 用户在一键登录授权页主动退出（返回或切换登录方式），路由侧据此静默。 */
export class QuickLoginCancelledError extends Error {
  readonly code = "USER_CANCELLED";

  /**
   * 退出方式：
   * - switch：点了授权页底部「验证码或密码登录」，回到登录页露出表单；
   * - exit：点了返回按钮/返回键，退出登录页回首页。
   */
  constructor(readonly reason: "switch" | "exit") {
    super("一键登录已取消");
    this.name = "QuickLoginCancelledError";
  }

  /** 从授权结果的 cancelled 标记构造；无标记返回 null。 */
  static from(result: { cancelled?: "switch" | "exit" }) {
    return result.cancelled ? new QuickLoginCancelledError(result.cancelled) : null;
  }
}
