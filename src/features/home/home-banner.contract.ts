import { Platform } from "react-native";

import type { Banner, HomeBannerSlotCode } from "./api/home.types";

export const HOME_BANNER_SLOT_CODES: HomeBannerSlotCode[] = [
  "APP_HOME_FLOOR1",
  "APP_HOME_FLOOR2",
  "APP_HOME_FLOOR3",
];

/** 按端跳转协议动作：route 为 App 内路由，url 为外链，none 为未配置或配置非法。 */
export type BannerJump =
  | { type: "route"; path: string; params: Record<string, string> }
  | { type: "url"; url: string }
  | { type: "none" };

type BannerAction =
  | { type: "image" | "link"; url: string }
  | { type: "route"; path: string; params: Record<string, string> }
  | { type: "none" };

/** 后台按端配置的跳转协议结构（linkUrl 内的 JSON，后端原样透传）。 */
type BannerJumpConfig = {
  jumpType?: unknown;
  jumpUrl?: unknown;
  params?: unknown;
};

/** 当前端对应的协议 key：iOS 取 IOS，其余（Android）取 ANDROID。 */
function getPlatformKey(): "IOS" | "ANDROID" {
  if (Platform.OS === "ios") {
    return "IOS";
  }
  return "ANDROID";
}

/** jumpUrl 是否为合法外链（仅允许 http/https 协议）。 */
function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** 把后台 params 字段防御式收敛为 Record<string, string>，非法时返回空对象。 */
function parseJumpParams(raw: unknown): Record<string, string> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return {};
  }
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "string") {
      params[key] = value;
    }
  }
  return params;
}

/**
 * 解析按端跳转协议：linkUrl 里可能存的是后台按端配置的 JSON（如秒杀入口）。
 * 任何一步不合法（JSON 解析失败 / 非对象 / 缺端 key / 缺或非法 jumpType /
 * ROUTE 缺以 / 开头的 jumpUrl / URL 缺合法外链）一律返回 none，由调用方回退存量逻辑。
 */
export function parseBannerJump(linkUrl?: string): BannerJump {
  if (!linkUrl) {
    return { type: "none" };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(linkUrl);
  } catch {
    return { type: "none" };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { type: "none" };
  }
  const config = (parsed as Record<string, unknown>)[getPlatformKey()];
  if (typeof config !== "object" || config === null || Array.isArray(config)) {
    return { type: "none" };
  }
  const { jumpType, jumpUrl } = config as BannerJumpConfig;
  if (jumpType === "ROUTE") {
    if (typeof jumpUrl !== "string" || !jumpUrl.startsWith("/")) {
      return { type: "none" };
    }
    return { type: "route", path: jumpUrl, params: parseJumpParams((config as BannerJumpConfig).params) };
  }
  if (jumpType === "URL") {
    if (typeof jumpUrl !== "string" || !isValidHttpUrl(jumpUrl)) {
      return { type: "none" };
    }
    return { type: "url", url: jumpUrl };
  }
  return { type: "none" };
}

/** 按后台约定优先展示内容图，其次跳转链接，未配置点击内容时仅展示素材。 */
export function getBannerAction(banner: Banner): BannerAction {
  // 优先解析按端跳转协议（秒杀等活动入口走这里）。
  const jump = parseBannerJump(banner.linkUrl);
  if (jump.type === "route") {
    return { type: "route", path: jump.path, params: jump.params };
  }
  if (jump.type === "url") {
    return { type: "link", url: jump.url };
  }
  // 协议解析失败时回退存量逻辑，兼容旧素材。
  if (banner.contentImageUrl) {
    return { type: "image", url: banner.contentImageUrl };
  }
  if (banner.linkUrl) {
    return { type: "link", url: banner.linkUrl };
  }
  return { type: "none" };
}
