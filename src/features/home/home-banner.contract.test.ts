import { describe, expect, it } from "vitest";

import { getBannerAction, isBannerSlotCarousel } from "./home-banner.contract";
import type { HomeBannerSlot } from "./api/home.types";

const banner = { id: "1-2", imageUrl: "https://cdn.example.com/display.jpg" };

describe("资源位素材点击行为", () => {
  it("同时配置内容图和链接时优先预览内容图，不把展示图当作内容图", () => {
    expect(getBannerAction({ ...banner, contentImageUrl: "https://cdn.example.com/content.jpg", linkUrl: "https://example.com" }))
      .toEqual({ type: "image", url: "https://cdn.example.com/content.jpg" });
  });

  it("只配置链接时打开链接", () => {
    expect(getBannerAction({ ...banner, linkUrl: "https://example.com" }))
      .toEqual({ type: "link", url: "https://example.com" });
  });

  it("只有展示图时不可点击，不再沿用旧接口预览展示图的行为", () => {
    expect(getBannerAction(banner)).toEqual({ type: "none" });
  });
});

function slot(partial: Partial<HomeBannerSlot> & Pick<HomeBannerSlot, "code" | "items">): HomeBannerSlot {
  return { name: "首页活动", displayMode: "TILE", intervalMs: 5000, ...partial };
}

describe("楼层轮播规则", () => {
  it("一、二层同层多张素材时即使后台标记 TILE 也走轮播", () => {
    expect(isBannerSlotCarousel(slot({ code: "APP_HOME_FLOOR1", items: [banner, { ...banner, id: "3-4" }] }))).toBe(true);
    expect(isBannerSlotCarousel(slot({ code: "APP_HOME_FLOOR2", displayMode: "TILE", items: [banner, { ...banner, id: "3-4" }] }))).toBe(true);
  });

  it("一、二层只有一张素材时平铺展示", () => {
    expect(isBannerSlotCarousel(slot({ code: "APP_HOME_FLOOR1", displayMode: "CAROUSEL", items: [banner] }))).toBe(false);
  });

  it("第三层多张素材仍按后台 displayMode 平铺展示", () => {
    expect(isBannerSlotCarousel(slot({ code: "APP_HOME_FLOOR3", items: [banner, { ...banner, id: "3-4" }] }))).toBe(false);
    expect(isBannerSlotCarousel(slot({ code: "APP_HOME_FLOOR3", displayMode: "CAROUSEL", items: [banner, { ...banner, id: "3-4" }] }))).toBe(true);
  });
});
