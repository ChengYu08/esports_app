import { describe, expect, it } from "vitest";

import { getBannerAction } from "./home-banner.contract";

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
