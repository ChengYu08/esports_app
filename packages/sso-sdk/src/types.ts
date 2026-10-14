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
  /** Optional diagnostic hook. It never receives request bodies or credentials. */
  onRequestLog?: (log: SsoRequestLog) => void;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
};

export type SsoRequestOptions = {
  method?: HttpMethod;
  data?: Record<string, unknown>;
  headers?: Record<string, string>;
  skipCodeCheck?: boolean;
};

export type QuickLoginAuthToken = { jwtToken: string; accessToken: string };

export type QuickLoginProvider = {
  checkLoginAvailable: (tokens: QuickLoginAuthToken) => Promise<boolean>;
  getLoginToken: (
    tokens: QuickLoginAuthToken,
  ) => Promise<{ spToken: string; phone?: string }>;
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
