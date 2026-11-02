import type { Banner, HomeBannerSlot, HomeBannerSlotCode } from "./api/home.types";

export const HOME_BANNER_SLOT_CODES: HomeBannerSlotCode[] = [
  "APP_HOME_FLOOR1",
  "APP_HOME_FLOOR2",
  "APP_HOME_FLOOR3",
];

/** 一、二层同层返回多张素材时轮播展示（不看后台 displayMode）；第三层固定平铺。 */
export function isBannerSlotCarousel(
  slot: Pick<HomeBannerSlot, "code" | "items" | "displayMode">,
): boolean {
  if (slot.code === "APP_HOME_FLOOR3") {
    return slot.displayMode === "CAROUSEL";
  }
  return slot.items.length > 1;
}

type BannerAction = { type: "image" | "link"; url: string } | { type: "none" };

/** 按后台约定优先展示内容图，其次跳转链接，未配置点击内容时仅展示素材。 */
export function getBannerAction(banner: Banner): BannerAction {
  if (banner.contentImageUrl) {
    return { type: "image", url: banner.contentImageUrl };
  }
  if (banner.linkUrl) {
    return { type: "link", url: banner.linkUrl };
  }
  return { type: "none" };
}
