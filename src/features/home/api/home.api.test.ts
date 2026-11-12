import { afterEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/core/network/api-client";
import { fetchBanners, fetchClubDetail, fetchClubGameCompanionCounts, fetchClubGameModes, fetchClubOnlineCount, fetchClubPage, fetchCompanionPage, fetchGameCategories, fetchGames, fetchHomePopup, fetchPriceList } from "./home.api";

vi.mock("@/core/network/api-client", () => ({ apiClient: vi.fn() }));

// home.api 依赖的 home-banner.contract 运行时引用 react-native，node 测试环境无法加载，这里桩掉。
// 本套件不触达 Platform 取值，桩值仅用于阻断 react-native 进入 import 图。
vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));

afterEach(() => vi.clearAllMocks());

it("价目表优先使用多图并兼容旧单图，过滤空地址和空分类", async () => {
  vi.mocked(apiClient).mockResolvedValue({ code: "SUCCESS", data: { tabs: [
    { menuTitle: "旧分类", imageUrls: [" ", null], imageUrl: " old.jpg ", sortNo: 2 },
    { menuTitle: "多图", imageUrls: [" a.jpg ", "", null, "b.jpg"], imageUrl: "ignored.jpg", sortNo: 1 },
    { menuTitle: "空分类", imageUrls: [], imageUrl: " " },
  ] } });

  expect(await fetchPriceList("group")).toEqual([
    { menuTitle: "多图", imageUrls: ["a.jpg", "b.jpg"], sortNo: 1 },
    { menuTitle: "旧分类", imageUrls: ["old.jpg"], sortNo: 2 },
  ]);
});

it("俱乐部模式筛选只包含当前俱乐部及未指定俱乐部的模式", async () => {
  vi.mocked(apiClient).mockResolvedValue({ code: "SUCCESS", data: [
    { id: 1, clubId: 10, modeName: "排位", status: 1 },
    { id: 2, clubId: 20, modeName: "其他俱乐部", status: 1 },
    { id: 3, modeName: "通用", status: 1 },
    { id: 4, clubId: 10, modeName: "已停用", status: 0 },
  ] });
  expect((await fetchClubGameModes("8", "10")).map((mode) => mode.id)).toEqual([1, 3]);
});

describe("首页活动轮播下发", () => {
  it("批量查询 App 三层资源位，按楼层和素材顺序展示，不混入 PC 素材", async () => {
    const controller = new AbortController();
    vi.mocked(apiClient).mockResolvedValue({
      code: "SUCCESS",
      data: [
        { slotCode: "APP_HOME_FLOOR3", slotName: "APP首页三楼", displayMode: "TILE", items: [
          { deliveryId: 8, materialId: 21, displayImageUrl: "https://cdn.example.com/b.jpg", sort: 2 },
          { deliveryId: 8, materialId: 22, displayImageUrl: " https://cdn.example.com/a.jpg ", sort: 1,
            materialName: " 活动详情 ", contentImageUrl: " https://cdn.example.com/detail.jpg ",
            linkUrl: "https://example.com/activity",
            linkConfig: { PC: { jumpType: "URL", jumpUrl: "https://pc.example.com" }, IOS: { jumpType: "ROUTE", jumpUrl: "/activity", params: { activityCode: "X" } } } },
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
        contentImageUrl: "https://cdn.example.com/detail.jpg", linkUrl: "https://example.com/activity",
        linkConfig: { PC: { jumpType: "URL", jumpUrl: "https://pc.example.com" }, IOS: { jumpType: "ROUTE", jumpUrl: "/activity", params: { activityCode: "X" } } } }),
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

describe("首页开屏弹窗资源位", () => {
  it("按 sort 映射多张素材并换算轮播间隔", async () => {
    const controller = new AbortController();
    vi.mocked(apiClient).mockResolvedValue({
      code: "SUCCESS",
      data: [{
        slotCode: "APP_HOME_POPUP",
        displayMode: "CAROUSEL",
        intervalSec: 5,
        items: [
          { deliveryId: 1, materialId: 2, displayImageUrl: "https://cdn.example.com/b.jpg", sort: 2 },
          { deliveryId: 1, materialId: 3, displayImageUrl: " https://cdn.example.com/a.jpg ", sort: 1,
            linkConfig: { ANDROID: { jumpType: "ROUTE", jumpUrl: "/club/[id]", params: { id: "9" } } } },
          { deliveryId: 1, materialId: 4, displayImageUrl: "  ", sort: 3 },
        ],
      }],
    });

    expect(await fetchHomePopup(controller.signal)).toEqual({
      intervalMs: 5000,
      items: [
        expect.objectContaining({
          id: "1-3",
          imageUrl: "https://cdn.example.com/a.jpg",
          linkConfig: { ANDROID: { jumpType: "ROUTE", jumpUrl: "/club/[id]", params: { id: "9" } } },
        }),
        expect.objectContaining({ id: "1-2", imageUrl: "https://cdn.example.com/b.jpg" }),
      ],
    });
    expect(apiClient).toHaveBeenCalledWith("/client/v1/ad/slot/list", {
      method: "POST",
      body: { slotCodes: ["APP_HOME_POPUP"] },
      signal: controller.signal,
    });
  });

  it("无有效展示图时返回 null", async () => {
    vi.mocked(apiClient).mockResolvedValue({
      code: "SUCCESS",
      data: [{ slotCode: "APP_HOME_POPUP", displayMode: "CAROUSEL", items: [] }],
    });
    expect(await fetchHomePopup()).toBeNull();
  });

  it("资源位缺失时返回 null", async () => {
    vi.mocked(apiClient).mockResolvedValue({ code: "SUCCESS", data: [] });
    expect(await fetchHomePopup()).toBeNull();
  });
});

describe("首页品类筛选与店铺标签", () => {
  it("保留后台品类顺序及游戏与品类的关联", async () => {
    vi.mocked(apiClient)
      .mockResolvedValueOnce({
        code: "SUCCESS",
        data: [{ id: 2, name: "手游", iconUrl: null, mobile_icon_url: "mobile.png" }, { id: 1, name: "端游", iconUrl: "pc.png", mobileIconUrl: "mobile-pc.png" }],
      })
      .mockResolvedValueOnce({
        code: "SUCCESS",
        data: [{ id: 11, gameName: "三角洲行动手游", gameCategoryId: 2 }],
      });

    expect(await fetchGameCategories()).toEqual([
      { id: "2", name: "手游", iconUrl: undefined, mobileIconUrl: "mobile.png" },
      { id: "1", name: "端游", iconUrl: "pc.png", mobileIconUrl: "mobile-pc.png" },
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

  it("优先依据俱乐部性质显示自营标签，旧接口回退名称", async () => {
    vi.mocked(apiClient).mockResolvedValue({ code: "SUCCESS", data: { records: [
      { id: 1, clubName: "盼之电竞", clubNature: "SELF_OPERATED" },
      { id: 2, clubName: "自营字样的普通店", clubNature: "THIRD_PARTY" },
      { id: 3, clubName: "未知性质" },
      { id: 4, clubName: "盼之自营俱乐部" },
    ] } });
    const result = await fetchClubPage({}, 1);
    expect(result.items.map((club) => club.isSelfOperated)).toEqual([true, false, false, true]);
  });

  it("接口业务失败进入重试状态，不显示成空列表", async () => {
    vi.mocked(apiClient).mockResolvedValue({ code: "FAILED", info: "服务暂不可用" });

    await expect(fetchClubPage({}, 1)).rejects.toThrow("服务暂不可用");
    await expect(fetchGameCategories()).rejects.toThrow("服务暂不可用");
    await expect(fetchGames()).rejects.toThrow("服务暂不可用");
  });
});

describe("俱乐部详情字段映射", () => {
  it("透传后台店铺标签，与俱乐部列表角标同源", async () => {
    vi.mocked(apiClient).mockResolvedValue({
      code: "SUCCESS",
      data: { id: 7, clubName: "奶蛙俱乐部", clubTag: "服务天花板", clubGames: [] },
    });

    const detail = await fetchClubDetail("7");

    expect(detail.clubTag).toBe("服务天花板");
  });

  it("未配置店铺标签时保持空值，详情页据此隐藏角标", async () => {
    vi.mocked(apiClient).mockResolvedValue({
      code: "SUCCESS",
      data: { id: 8, clubName: "普通俱乐部", clubTag: null, clubGames: [] },
    });

    const detail = await fetchClubDetail("8");

    expect(detail.clubTag).toBeUndefined();
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

describe("首页在线陪玩人数", () => {
  it("按俱乐部和游戏获取去重后的陪玩总数", async () => {
    vi.mocked(apiClient)
      .mockResolvedValueOnce({ code: "SUCCESS", data: { total: 7 } })
      .mockResolvedValueOnce({ code: "SUCCESS", data: { total: 2 } });
    expect(await fetchClubGameCompanionCounts("1000004", [14, 15, 14])).toEqual({ 14: 7, 15: 2 });
    expect(apiClient).toHaveBeenCalledTimes(2);
    expect(apiClient).toHaveBeenCalledWith("/client/v1/companion/public/page", {
      method: "POST",
      body: { page: 1, pageSize: 1, action: { clubId: 1000004, gameId: 14 } },
      signal: undefined,
    });
  });
  it("统计范围保留没有图标的启用游戏，排除停用游戏并去重", async () => {
    vi.mocked(apiClient).mockResolvedValue({ code: "SUCCESS", data: { records: [
      { id: 1000004, clubGames: [
        { gameId: 14, status: 1, iconUrl: "game.png" },
        { gameId: 15, status: 1 },
        { gameId: 14, status: 1 },
        { gameId: 16, status: 0 },
      ] },
    ] } });

    const page = await fetchClubPage({}, 1);

    expect(page.items[0].gameIds).toEqual([14, 15]);
    expect(page.items[0].games?.find((game) => game.id === 15)?.iconUrl).toBeUndefined();
  });

  it("保留服务端批量返回的在线人数和游戏陪玩人数", async () => {
    vi.mocked(apiClient).mockResolvedValue({ code: "SUCCESS", data: { records: [
      { id: 1000004, onlineCompanionCount: 2, clubGames: [
        { gameId: 14, status: 1, iconUrl: "game.png", companionCount: 5 },
        { gameId: 15, status: 1, companionCount: 3 },
      ] },
    ] } });
    const page = await fetchClubPage({}, 1);
    expect(page.items[0].onlineCompanionCount).toBe(2);
    expect(page.items[0].games?.map((game) => game.companionCount)).toEqual([5, 3]);
  });

  it("俱乐部有两名在线成员但只有一名在线陪玩时返回 1，查询携带必填游戏 ID", async () => {
    const controller = new AbortController();
    vi.mocked(apiClient).mockResolvedValue({ code: "SUCCESS", data: {
      total: 1, totalPages: 1,
      records: [{ profileId: 10, userId: 50100145, onlineStatus: 1, gameStatus: 0 }],
    } });

    expect(await fetchClubOnlineCount("1000004", [14], controller.signal)).toBe(1);
    expect(apiClient).toHaveBeenCalledWith("/client/v1/companion/public/page", {
      method: "POST",
      body: { page: 1, pageSize: 50, action: { clubId: 1000004, gameId: 14, onlineOnly: true } },
      signal: controller.signal,
    });
  });

  it("遍历分页并跨游戏按用户去重，空闲中和游戏中都计入，离线状态不计入", async () => {
    vi.mocked(apiClient)
      .mockResolvedValueOnce({ code: "SUCCESS", data: { totalPages: 2, records: [
        { profileId: 1, userId: 101, onlineStatus: 1, gameStatus: 0 },
      ] } })
      .mockResolvedValueOnce({ code: "SUCCESS", data: { totalPages: 2, records: [
        { profileId: 2, userId: 102, onlineStatus: 1, gameStatus: 1 },
      ] } })
      .mockResolvedValueOnce({ code: "SUCCESS", data: { totalPages: 1, records: [
        { profileId: 11, userId: 101, onlineStatus: 1, gameStatus: 1 },
        { profileId: 3, userId: 103, onlineStatus: 1, gameStatus: 0 },
        { profileId: 4, userId: 104, onlineStatus: 0, gameStatus: 1 },
      ] } });

    expect(await fetchClubOnlineCount("1000004", [14, 15, 14])).toBe(3);
    expect(vi.mocked(apiClient).mock.calls.map(([, options]) => options?.body)).toEqual([
      { page: 1, pageSize: 50, action: { clubId: 1000004, gameId: 14, onlineOnly: true } },
      { page: 2, pageSize: 50, action: { clubId: 1000004, gameId: 14, onlineOnly: true } },
      { page: 1, pageSize: 50, action: { clubId: 1000004, gameId: 15, onlineOnly: true } },
    ]);
  });

  it("没有启用游戏时人数为零，不发送缺少游戏 ID 的请求", async () => {
    expect(await fetchClubOnlineCount("1000004", [])).toBe(0);
    expect(apiClient).not.toHaveBeenCalled();
  });

  it("没有在线陪玩时返回真实的零人数", async () => {
    vi.mocked(apiClient).mockResolvedValue({ code: "SUCCESS", data: { totalPages: 0, records: [] } });

    expect(await fetchClubOnlineCount("1000004", [14])).toBe(0);
  });

  it("某个游戏查询失败时整体报错，不把部分人数当成俱乐部总人数", async () => {
    vi.mocked(apiClient)
      .mockResolvedValueOnce({ code: "SUCCESS", data: { totalPages: 1, records: [
        { profileId: 1, userId: 101, onlineStatus: 1 },
      ] } })
      .mockResolvedValueOnce({ code: "FAILED", info: "游戏数据加载失败" });

    await expect(fetchClubOnlineCount("1000004", [14, 15])).rejects.toThrow("游戏数据加载失败");
  });
});

describe("俱乐部对外号码", () => {
  it("列表展示靓号，业务ID仍为内部主键", async () => {
    vi.mocked(apiClient).mockResolvedValue({ code: "SUCCESS", data: {
      page: 1, totalPages: 1, records: [{ id: 50002, clubNo: "66688", clubName: "测试俱乐部" }],
    } });
    const result = await fetchClubPage({}, 1);
    expect(result.items[0]).toMatchObject({ id: "50002", clubCode: "66688" });
  });

  it("详情保留20位号码字符串且兼容旧响应", async () => {
    vi.mocked(apiClient).mockResolvedValueOnce({ code: "SUCCESS", data: {
      id: 50002, clubNo: "88888888888888888888", clubName: "测试俱乐部",
    } });
    expect(await fetchClubDetail("50002")).toMatchObject({ id: "50002", clubCode: "88888888888888888888" });
    vi.mocked(apiClient).mockResolvedValueOnce({ code: "SUCCESS", data: { id: 50002 } });
    expect(await fetchClubDetail("50002")).toMatchObject({ id: "50002", clubCode: "50002" });
  });
});
