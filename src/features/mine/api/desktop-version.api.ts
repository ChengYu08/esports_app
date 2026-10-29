import { apiClient } from "@/core/network/api-client";

export type DesktopPlatform = "ANDROID" | "IOS" | "WINDOWS";

/** 服务端启用的客户端版本（DesktopVersionVO，C 端 latest 返回）。 */
export type DesktopVersionInfo = {
  id: number;
  platform: string;
  versionNo: string;
  packageUrl: string;
  packageFileName?: string;
  updateContent?: string;
  /** 启用版本自身的强更开关：0否 1是 */
  forceUpdate?: number;
  /** 当前客户端是否需要强制更新：0否 1是（服务端结合 currentVersion 计算） */
  needForceUpdate?: number;
  enabled?: number;
};

type LatestResponse = {
  success?: boolean;
  code?: string | number;
  info?: string;
  data?: DesktopVersionInfo | null;
};

/**
 * 查询当前启用的客户端版本（用于更新检查；公开接口无需登录）。
 * 无启用版本时 data 为 null，返回 null 由调用方按“已是最新”处理。
 */
export async function fetchLatestDesktopVersion(
  platform: DesktopPlatform,
  currentVersion: string,
): Promise<DesktopVersionInfo | null> {
  const query = `platform=${encodeURIComponent(platform)}&currentVersion=${encodeURIComponent(currentVersion)}`;
  const response = await apiClient<LatestResponse>(
    `/client/v1/desktopVersion/public/latest?${query}`,
  );
  if (response?.success !== true || response.code !== "SUCCESS") {
    throw new Error(response?.info || "请求失败，请稍后重试");
  }
  return response.data ?? null;
}
