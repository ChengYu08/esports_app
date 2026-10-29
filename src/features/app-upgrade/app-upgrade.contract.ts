export type ClientApiResponse<T> = {
  success: boolean;
  code: string;
  info?: string;
  data?: T;
};

/** dj_desktop_version 的 platform 枚举 */
export type AppUpgradePlatform = "WINDOWS" | "ANDROID" | "IOS";

/** `GET /client/v1/desktopVersion/public/latest` 响应结构 */
export type AppVersionVO = {
  id?: number | string;
  platform?: string;
  /** 最新版本号 */
  versionNo?: string;
  /** 安装包下载地址（Android APK / iOS 安装链接） */
  packageUrl?: string;
  packageFileName?: string;
  /** 更新说明 */
  updateContent?: string;
  /** 启用版本自身的强制更新开关：0否 1是 */
  forceUpdate?: number;
  /** 结合当前客户端版本与历史强更版本计算的结果：0否 1是 */
  needForceUpdate?: number;
};

export type AppUpgradeRequestOptions = {
  method?: "GET";
  query?: Record<string, string>;
  timeoutMs?: number;
};

export type AppUpgradeRequester = <T>(
  path: string,
  options?: AppUpgradeRequestOptions,
) => Promise<ClientApiResponse<T>>;

export const APP_UPGRADE_LATEST_PATH = "/client/v1/desktopVersion/public/latest";

export function createAppUpgradeContract(requester: AppUpgradeRequester) {
  return {
    /** 成功但 data 缺省时返回 null（视为无版本数据） */
    async fetchLatestVersion(
      platform: AppUpgradePlatform,
      currentVersion: string,
    ): Promise<AppVersionVO | null> {
      const response = await requester<AppVersionVO>(APP_UPGRADE_LATEST_PATH, {
        method: "GET",
        query: { platform, currentVersion },
        timeoutMs: 5000,
      });
      if (!response.success || response.code !== "SUCCESS") {
        throw new Error(response.info || "请求失败");
      }
      return response.data ?? null;
    },
  };
}
