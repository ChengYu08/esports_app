import { afterEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/core/network/api-client";
import { fetchBanners, fetchClubPage, fetchCompanionPage, fetchGameCategories, fetchGames } from "./home.api";

vi.mock("@/core/network/api-client", () => ({ apiClient: vi.fn() }));

afterEach(() => vi.clearAllMocks());

describe("首页活动轮播下发", () => {
  it("批量查询 App 三层资源位，按楼层和素材顺序展示，不混入 PC 素材", async () => {
    const controller = new AbortController();
    vi.mocked(apiClient).mockResolvedValue({
      code: "SUCCESS",
      data: [
        { slotCode: "APP_HOME_FLOOR3", slotName: "APP首页三楼", displayMode: "TILE", items: [
          { deliveryId: 8, materialId: 21, displayImageUrl: "https://cdn.example.com/b.jpg", sort: 2 },
          { deliveryId: 8, materialId: 22, displayImageUrl: " https://cdn.example.com/a.jpg ", sort: 1,
            materialName: " 活动详情 ", contentImageUrl: " https://cdn.example.com/detail.jpg ", linkUrl: "https://example.com/activity" },
          { deliveryId: 8, materialId: 23, displayImageUrl: "  ", sort: 3 },
          { deliveryId: 8, materialId: 24, displayImageUrl: null, sort: 4 },
        ] },
        { slotCode: "PC_HOME_CAROUSEL", displayMode: "CAROUSEL", items: [
          { deliveryId: 9, materialId: 25, displayImageUrl: "pc.jpg" },
        ] },
        { slotCode: "APP_HOME_FLOOR2", slotName: "APP首页二楼", displayMode: "TILE", items: [] },
        { slotCode: "APP_HOME_FLOOR1", slotName: "APP首页一楼", displayMode: "CAROUSEL", intervalSec: 7, items: [
          { deliveryId: 10, materialId: 26, displayImageUrl: "first.jpg", linkUrl: "  " },
        ] },
      ],
    });

    const slots = await fetchBanners(controller.signal);

    expect(slots.map((slot) => slot.code)).toEqual(["APP_HOME_FLOOR1", "APP_HOME_FLOOR2", "APP_HOME_FLOOR3"]);
    expect(slots[0]).toMatchObject({ displayMode: "CAROUSEL", intervalMs: 7000 });
    expect(slots[0].items[0].linkUrl).toBeUndefined();
    expect(slots[1].items).toEqual([]);
    expect(slots[2]).toMatchObject({ displayMode: "TILE", intervalMs: 5000 });
    expect(slots[2].items).toEqual([
      expect.objectContaining({ id: "8-22", imageUrl: "https://cdn.example.com/a.jpg", title: "活动详情",
        contentImageUrl: "https://cdn.example.com/detail.jpg", linkUrl: "https://example.com/activity" }),
      expect.objectContaining({ id: "8-21", imageUrl: "https://cdn.example.com/b.jpg" }),
    ]);
    expect(apiClient).toHaveBeenCalledWith("/client/v1/ad/slot/list", {
      method: "POST",
      body: { slotCodes: ["APP_HOME_FLOOR1", "APP_HOME_FLOOR2", "APP_HOME_FLOOR3"] },
      signal: controller.signal,
    });
  });

  it("某层停用或缺失不影响其他楼层，也不将其他素材补到该楼层", async () => {
    vi.mocked(apiClient).mockResolvedValue({
      code: "SUCCESS",
      data: [{ slotCode: "APP_HOME_FLOOR2", displayMode: "TILE", items: [
        { deliveryId: 8, materialId: 22, displayImageUrl: "second.jpg" },
      ] }],
    });

    expect(await fetchBanners()).toEqual([expect.objectContaining({
      code: "APP_HOME_FLOOR2", items: [expect.objectContaining({ imageUrl: "second.jpg" })],
    })]);
  });

  it.each([0, -1, null, undefined])("轮播间隔未配置或无效时使用默认值：%j", async (intervalSec) => {
    vi.mocked(apiClient).mockResolvedValue({ code: "SUCCESS", data: [
      { slotCode: "APP_HOME_FLOOR1", displayMode: "CAROUSEL", intervalSec, items: null },
    ] });

    expect(await fetchBanners()).toEqual([expect.objectContaining({ intervalMs: 5000, items: [] })]);
  });

  it.each([[], null, undefined])("后台没有生效素材时不显示演示 Banner：%j", async (data) => {
    vi.mocked(apiClient).mockResolvedValue({ code: "SUCCESS", data });

    expect(await fetchBanners()).toEqual([]);
  });

  it("业务失败进入查询错误状态，不返回演示素材", async () => {
    vi.mocked(apiClient).mockResolvedValue({ code: "FAILED", info: "活动加载失败" });

    await expect(fetchBanners()).rejects.toThrow("活动加载失败");
  });
});

describe("首页品类筛选与店铺标签", () => {
  it("保留后台品类顺序及游戏与品类的关联", async () => {
    vi.mocked(apiClient)
      .mockResolvedValueOnce({
        code: "SUCCESS",
        data: [{ id: 2, name: "手游", iconUrl: null }, { id: 1, name: "端游", iconUrl: "pc.png" }],
      })
      .mockResolvedValueOnce({
        code: "SUCCESS",
        data: [{ id: 11, gameName: "三角洲行动手游", gameCategoryId: 2 }],
      });

    expect(await fetchGameCategories()).toEqual([
      { id: "2", name: "手游", iconUrl: undefined },
      { id: "1", name: "端游", iconUrl: "pc.png" },
    ]);
    expect(await fetchGames()).toEqual([expect.objectContaining({ id: 11, gameCategoryId: "2" })]);
  });

  it("首次加载全部俱乐部时不传游戏或品类，不把空值转换成 0", async () => {
    vi.mocked(apiClient).mockResolvedValue({ code: "SUCCESS", data: { records: [] } });

    await fetchClubPage({}, 1);

    expect(apiClient).toHaveBeenCalledWith("/client/v1/club/public/page", expect.objectContaining({
      body: { page: 1, pageSize: 10, action: {} },
    }));
  });

  it("全部游戏保留品类筛选，具体游戏和后续分页携带组合条件", async () => {
    vi.mocked(apiClient).mockResolvedValue({ code: "SUCCESS", data: { records: [] } });
    const controller = new AbortController();

    await fetchClubPage({ gameCategoryId: "2" }, 1);
    await fetchClubPage({ gameCategoryId: "2", gameId: "11" }, 2, 10, controller.signal);

    expect(apiClient).toHaveBeenNthCalledWith(1, "/client/v1/club/public/page", expect.objectContaining({
      body: { page: 1, pageSize: 10, action: { gameCategoryId: 2 } },
    }));
    expect(apiClient).toHaveBeenNthCalledWith(2, "/client/v1/club/public/page", expect.objectContaining({
      body: { page: 2, pageSize: 10, action: { gameId: 11, gameCategoryId: 2 } },
      signal: controller.signal,
    }));
  });

  it("店铺角标使用后台文字，未配置时保持隐藏，同时保留分页信息", async () => {
    vi.mocked(apiClient).mockResolvedValue({
      code: "SUCCESS",
      data: {
        page: 1,
        totalPages: 2,
        records: [
          { id: 7, clubName: "奶蛙俱乐部", clubTag: "服务天花板" },
          { id: 8, clubName: "金牌俱乐部", clubTag: "金牌店铺" },
          { id: 9, clubName: "普通俱乐部", clubTag: null },
        ],
      },
    });

    const result = await fetchClubPage({}, 1);

    expect(result.items.map((club) => club.clubTag)).toEqual(["服务天花板", "金牌店铺", undefined]);
    expect(result).toMatchObject({ hasMore: true, nextPage: 2 });
  });

  it("接口业务失败进入重试状态，不显示成空列表", async () => {
    vi.mocked(apiClient).mockResolvedValue({ code: "FAILED", info: "服务暂不可用" });

    await expect(fetchClubPage({}, 1)).rejects.toThrow("服务暂不可用");
    await expect(fetchGameCategories()).rejects.toThrow("服务暂不可用");
    await expect(fetchGames()).rejects.toThrow("服务暂不可用");
  });
});

describe("俱乐部陪玩列表字段映射", () => {
  it("陪玩列表映射标签与模式/等级/服务字段，缺省时兜底空值", async () => {
    vi.mocked(apiClient).mockResolvedValue({
      code: "SUCCESS",
      data: {
        page: 1,
        totalPages: 1,
        records: [
          {
            profileId: 29,
            userId: 50100075,
            nickname: "哈吉蜂",
            sex: 1,
            age: 21,
            tagName: "明星",
            tagBackgroundColor: "#138666",
            tagMobileBackgroundColor: "#FE4267",
            gameName: "三角洲行动手游",
            modeName: "大乱斗",
            levelName: "星耀",
            clubGameServiceName: "陪玩",
            orderCount: 10,
            onlineStatus: 1,
            gameStatus: 1,
            price: 112,
          },
          { profileId: 68, nickname: "盼友", sex: 2, orderCount: 0 },
        ],
      },
    });

    const page = await fetchCompanionPage({ clubId: "1000006", gameId: "11" });

    expect(page.items[0]).toMatchObject({
      tagName: "明星",
      tagBackgroundColor: "#138666",
      gameName: "三角洲行动手游",
      modeName: "大乱斗",
      levelName: "星耀",
      serviceName: "陪玩",
      age: 21,
      price: 112,
      onlineStatus: 1,
      gameStatus: 1,
    });
    expect(page.items[1]).toMatchObject({
      tagName: "",
      tagBackgroundColor: "",
      gameName: "",
      modeName: "",
      levelName: "",
      serviceName: "",
      age: null,
      signature: "",
      onlineStatus: 0,
    });
  });

  it("标签背景色直接使用后台通用色值，未下发时兜底空字符串", async () => {
    vi.mocked(apiClient).mockResolvedValue({
      code: "SUCCESS",
      data: {
        page: 1,
        totalPages: 1,
        records: [
          {
            profileId: 1,
            nickname: "甲",
            tagName: "魔王pro",
            tagBackgroundColor: "#8F4033",
            tagMobileBackgroundColor: "#FE4267",
          },
          { profileId: 2, nickname: "乙", tagName: "明星" },
        ],
      },
    });

    const page = await fetchCompanionPage({ clubId: "1000006", gameId: "11" });

    expect(page.items[0]).toMatchObject({ tagName: "魔王pro", tagBackgroundColor: "#8F4033" });
    expect(page.items[1]).toMatchObject({ tagName: "明星", tagBackgroundColor: "" });
  });
});
