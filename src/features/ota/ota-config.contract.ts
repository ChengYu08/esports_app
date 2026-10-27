export type ClientApiResponse<T> = {
  success: boolean;
  code: string;
  info?: string;
  data?: T;
};

/** react-native-update 的 updateStrategy 合法值 */
export type OtaUpdateStrategy =
  | "alwaysAlert"
  | "alertUpdateAndIgnoreError"
  | "silentAndNow"
  | "silentAndLater"
  | null;

/** 配置中心 key `pzdj_app_rn_update_config` 的值结构 */
export type OtaConfig = {
  /** 远端目标 RN 业务版号，与本地 RN_BUNDLE_VERSION 比对 */
  version: number;
  updateStrategy?: OtaUpdateStrategy;
};

export type OtaConfigRequestOptions = {
  method: "GET";
  query: Record<string, string>;
  timeoutMs?: number;
};

export type OtaConfigRequester = <T>(
  path: string,
  options?: OtaConfigRequestOptions,
) => Promise<ClientApiResponse<T>>;

export function createOtaConfigContract(requester: OtaConfigRequester) {
  return {
    /** 返回配置值原始 JSON 文本；成功但 data 缺省时返回 null（视为无配置） */
    async fetchOtaConfig(key: string): Promise<string | null> {
      const response = await requester<string>(
        "/client/v1/commonConfig/public/get",
        { method: "GET", query: { key }, timeoutMs: 5000 },
      );
      if (!response.success || response.code !== "SUCCESS") {
        throw new Error(response.info || "请求失败");
      }
      return response.data ?? null;
    },
  };
}
