import { afterEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/core/network/api-client";
import { fetchClubPage, fetchGameCategories, fetchGames } from "./home.api";

vi.mock("@/core/network/api-client", () => ({ apiClient: vi.fn() }));

afterEach(() => vi.clearAllMocks());

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
