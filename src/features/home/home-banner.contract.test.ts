import { beforeEach, describe, expect, it, vi } from "vitest";

import { getBannerAction, parseBannerJump } from "./home-banner.contract";

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
const jumpJson = JSON.stringify({
  PC: { jumpType: "URL", jumpUrl: "https://www.baodi.com", params: {} },
  IOS: { jumpType: "ROUTE", jumpUrl: "/clubs", params: { aaaaa: "1" } },
  ANDROID: { jumpType: "ROUTE", jumpUrl: "/clubs", params: { id: "1" } },
});

describe("parseBannerJump 按端跳转协议", () => {
  beforeEach(() => {
    platformState.os = "android";
  });

  it("ANDROID 端取 ANDROID 配置解析为路由动作", () => {
    platformState.os = "android";
    expect(parseBannerJump(jumpJson)).toEqual({ type: "route", path: "/clubs", params: { id: "1" } });
  });

  it("IOS 端取 IOS 配置解析为路由动作", () => {
    platformState.os = "ios";
    expect(parseBannerJump(jumpJson)).toEqual({ type: "route", path: "/clubs", params: { aaaaa: "1" } });
  });

  it("jumpType 为 URL 时解析为外链动作", () => {
    expect(
      parseBannerJump(JSON.stringify({ ANDROID: { jumpType: "URL", jumpUrl: "https://www.baodi.com", params: {} } })),
    ).toEqual({ type: "url", url: "https://www.baodi.com" });
  });

  it("ROUTE 未配置 params 时返回空参数", () => {
    expect(parseBannerJump(JSON.stringify({ ANDROID: { jumpType: "ROUTE", jumpUrl: "/clubs" } }))).toEqual({
      type: "route",
      path: "/clubs",
      params: {},
    });
  });

  it.each([
    ["非 JSON 字符串", "not-json"],
    ["空字符串", ""],
    ["undefined", undefined],
    ["解析结果非对象", "123"],
    ["缺当前端 key", JSON.stringify({ PC: { jumpType: "ROUTE", jumpUrl: "/clubs", params: {} } })],
    ["缺 jumpType", JSON.stringify({ ANDROID: { jumpUrl: "/clubs", params: {} } })],
    ["jumpType 非 ROUTE|URL", JSON.stringify({ ANDROID: { jumpType: "SCHEME", jumpUrl: "/clubs", params: {} } })],
    ["ROUTE 跳转地址非 / 开头", JSON.stringify({ ANDROID: { jumpType: "ROUTE", jumpUrl: "clubs", params: {} } })],
    ["URL 跳转地址非法", JSON.stringify({ ANDROID: { jumpType: "URL", jumpUrl: "javascript:alert(1)", params: {} } })],
  ])("%s 时返回 none", (_name, linkUrl) => {
    expect(parseBannerJump(linkUrl)).toEqual({ type: "none" });
  });
});

describe("getBannerAction 接入跳转协议", () => {
  beforeEach(() => {
    platformState.os = "android";
  });

  it("协议为 ROUTE 时返回路由动作，优先于内容图", () => {
    expect(getBannerAction({ ...banner, contentImageUrl: "https://cdn.example.com/content.jpg", linkUrl: jumpJson }))
      .toEqual({ type: "route", path: "/clubs", params: { id: "1" } });
  });

  it("协议为 URL 时返回外链动作，优先于内容图", () => {
    const urlJson = JSON.stringify({ ANDROID: { jumpType: "URL", jumpUrl: "https://www.baodi.com", params: {} } });
    expect(getBannerAction({ ...banner, contentImageUrl: "https://cdn.example.com/content.jpg", linkUrl: urlJson }))
      .toEqual({ type: "link", url: "https://www.baodi.com" });
  });

  it("协议解析失败时回退内容图优先的存量逻辑", () => {
    expect(
      getBannerAction({ ...banner, contentImageUrl: "https://cdn.example.com/content.jpg", linkUrl: "not-json" }),
    ).toEqual({ type: "image", url: "https://cdn.example.com/content.jpg" });
  });

  it("协议解析失败且无内容图时回退存量外链（存量 http linkUrl 兼容）", () => {
    expect(getBannerAction({ ...banner, linkUrl: "https://example.com" }))
      .toEqual({ type: "link", url: "https://example.com" });
  });
});
