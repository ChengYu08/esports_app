import { beforeEach, describe, expect, it, vi } from "vitest";

import { getBannerAction, isBannerSlotCarousel, parseBannerJump } from "./home-banner.contract";
import type { HomeBannerSlot } from "./api/home.types";

// react-native 在 node 测试环境无法加载，这里只桩出 Platform.OS 供按端协议取值。
const platformState = vi.hoisted(() => ({ os: "android" as "android" | "ios" }));

vi.mock("react-native", () => ({
  Platform: {
    get OS() {
      return platformState.os;
    },
  },
}));

const banner = { id: "1-2", imageUrl: "https://cdn.example.com/display.jpg" };

describe("资源位素材点击行为", () => {
  beforeEach(() => {
    platformState.os = "android";
  });

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

/** 按端跳转协议样例：PC 外链，IOS/ANDROID 走 App 内路由。 */
const jumpConfig = {
  PC: { jumpType: "URL", jumpUrl: "https://www.baodi.com", params: {} },
  IOS: { jumpType: "ROUTE", jumpUrl: "/club/[id]", params: { id: "1", aaaaa: "1" } },
  ANDROID: { jumpType: "ROUTE", jumpUrl: "/club/[id]", params: { id: "1" } },
};

describe("parseBannerJump 按端跳转协议", () => {
  beforeEach(() => {
    platformState.os = "android";
  });

  it("ANDROID 端取 ANDROID 配置解析为俱乐部首页路由", () => {
    expect(parseBannerJump(jumpConfig)).toEqual({ type: "route", path: "/club/[id]", params: { id: "1" } });
  });

  it("IOS 端取 IOS 配置解析为俱乐部首页路由", () => {
    platformState.os = "ios";
    expect(parseBannerJump(jumpConfig)).toEqual({
      type: "route",
      path: "/club/[id]",
      params: { id: "1", aaaaa: "1" },
    });
  });

  it("jumpType 为 URL 时解析为外链动作", () => {
    expect(parseBannerJump({ ANDROID: { jumpType: "URL", jumpUrl: "https://www.baodi.com", params: {} } }))
      .toEqual({ type: "url", url: "https://www.baodi.com" });
  });

  it("俱乐部首页缺 id 仍解析为 route（缺参由目标页兜底）", () => {
    expect(parseBannerJump({ ANDROID: { jumpType: "ROUTE", jumpUrl: "/club/[id]", params: {} } })).toEqual({
      type: "route",
      path: "/club/[id]",
      params: {},
    });
  });

  it("活动落地页无 activityCode 仍解析为 route", () => {
    expect(parseBannerJump({ ANDROID: { jumpType: "ROUTE", jumpUrl: "/activity", params: {} } })).toEqual({
      type: "route",
      path: "/activity",
      params: {},
    });
  });

  it("未登记路径 /clubs 允许通过解析", () => {
    expect(parseBannerJump({ ANDROID: { jumpType: "ROUTE", jumpUrl: "/clubs", params: { id: "1" } } })).toEqual({
      type: "route",
      path: "/clubs",
      params: { id: "1" },
    });
  });

  it("params 含非字符串值时只保留字符串项", () => {
    expect(
      parseBannerJump({
        ANDROID: { jumpType: "ROUTE", jumpUrl: "/club/[id]", params: { id: "1", count: 2 } },
      }),
    ).toEqual({ type: "route", path: "/club/[id]", params: { id: "1" } });
  });

  it.each([
    ["/web-view"],
    ["/account-cancellation"],
    ["/forgot-password"],
  ])("敏感路径 %s 命中黑名单返回 none", (jumpUrl) => {
    expect(parseBannerJump({ ANDROID: { jumpType: "ROUTE", jumpUrl, params: {} } })).toEqual({ type: "none" });
  });

  it.each([
    ["空对象", {}],
    ["undefined", undefined],
    ["null", null],
    ["端节点非对象", { ANDROID: "ROUTE" }],
    ["缺当前端 key", { PC: { jumpType: "ROUTE", jumpUrl: "/club/[id]", params: { id: "1" } } }],
    ["缺 jumpType", { ANDROID: { jumpUrl: "/club/[id]", params: { id: "1" } } }],
    ["jumpType 非 ROUTE|URL", { ANDROID: { jumpType: "SCHEME", jumpUrl: "/club/[id]", params: { id: "1" } } }],
    ["ROUTE 跳转地址非 / 开头", { ANDROID: { jumpType: "ROUTE", jumpUrl: "club/[id]", params: { id: "1" } } }],
    ["URL 跳转地址非法", { ANDROID: { jumpType: "URL", jumpUrl: "javascript:alert(1)", params: {} } }],
  ])("%s 时返回 none", (_name, linkConfig) => {
    expect(parseBannerJump(linkConfig as never)).toEqual({ type: "none" });
  });
});

describe("getBannerAction 接入跳转协议", () => {
  beforeEach(() => {
    platformState.os = "android";
  });

  it("协议为 ROUTE 时返回路由动作，优先于内容图", () => {
    expect(getBannerAction({ ...banner, contentImageUrl: "https://cdn.example.com/content.jpg", linkConfig: jumpConfig }))
      .toEqual({ type: "route", path: "/club/[id]", params: { id: "1" } });
  });

  it("协议为 URL 时返回外链动作，优先于内容图", () => {
    expect(
      getBannerAction({
        ...banner,
        contentImageUrl: "https://cdn.example.com/content.jpg",
        linkConfig: { ANDROID: { jumpType: "URL", jumpUrl: "https://www.baodi.com", params: {} } },
      }),
    ).toEqual({ type: "link", url: "https://www.baodi.com" });
  });

  it("协议解析失败时回退内容图优先的存量逻辑", () => {
    expect(
      getBannerAction({ ...banner, contentImageUrl: "https://cdn.example.com/content.jpg", linkConfig: { ANDROID: {} } }),
    ).toEqual({ type: "image", url: "https://cdn.example.com/content.jpg" });
  });

  it("未配置协议且无内容图时回退存量外链（存量 http linkUrl 兼容）", () => {
    expect(getBannerAction({ ...banner, linkUrl: "https://example.com" }))
      .toEqual({ type: "link", url: "https://example.com" });
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
