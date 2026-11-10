import { Platform } from "react-native";

import type { Banner, BannerJumpConfig, HomeBannerSlot, HomeBannerSlotCode } from "./api/home.types";
import { isDeniedBannerRoute } from "./banner-route-deny";

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

/** 一、二层同层返回多张素材时轮播展示（不看后台 displayMode）；第三层固定平铺。 */
export function isBannerSlotCarousel(
  slot: Pick<HomeBannerSlot, "code" | "items" | "displayMode">,
): boolean {
  if (slot.code === "APP_HOME_FLOOR3") {
    return slot.displayMode === "CAROUSEL";
  }
  return slot.items.length > 1;
}

type BannerAction =
  | { type: "image" | "link"; url: string }
  | { type: "route"; path: string; params: Record<string, string> }
  | { type: "none" };

/** 后台按端配置的跳转协议结构（linkConfig 内的端 key 对应的节点）。 */
type BannerJumpNode = {
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
 * 解析按端跳转协议：后台 linkConfig 独立结构化字段（如活动入口）。
 * 任何一步不合法（缺端 key / 缺或非法 jumpType / ROUTE 缺以 / 开头的
 * jumpUrl / 命中敏感路径黑名单 / URL 缺合法外链）一律返回 none，
 * 由调用方回退存量逻辑。缺参由目标页自行兜底。
 */
export function parseBannerJump(linkConfig?: BannerJumpConfig | null): BannerJump {
  if (!linkConfig) {
    return { type: "none" };
  }
  const node = linkConfig[getPlatformKey()];
  if (typeof node !== "object" || node === null || Array.isArray(node)) {
    return { type: "none" };
  }
  const { jumpType, jumpUrl } = node as BannerJumpNode;
  if (jumpType === "ROUTE") {
    if (typeof jumpUrl !== "string" || !jumpUrl.startsWith("/")) {
      return { type: "none" };
    }
    if (isDeniedBannerRoute(jumpUrl)) {
      return { type: "none" };
    }
    return { type: "route", path: jumpUrl, params: parseJumpParams((node as BannerJumpNode).params) };
  }
  if (jumpType === "URL") {
    if (typeof jumpUrl !== "string" || !isValidHttpUrl(jumpUrl)) {
      return { type: "none" };
    }
    return { type: "url", url: jumpUrl };
  }
  return { type: "none" };
}

/** 按后台约定优先解析 linkConfig 按端跳转协议，其次展示内容图，再跳转链接，未配置点击内容时仅展示素材。 */
export function getBannerAction(banner: Banner): BannerAction {
  // 优先解析按端跳转协议（活动入口走这里）。
  const jump = parseBannerJump(banner.linkConfig);
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
