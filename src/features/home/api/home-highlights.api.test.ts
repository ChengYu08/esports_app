import { afterEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/core/network/api-client";
import { fetchHomeBroadcasts, fetchHomeHighlightClubs, fetchHomeHighlightRanking, resolveHomeHighlightClub } from "./home-highlights.api";

vi.mock("@/core/network/api-client", () => ({ apiClient: vi.fn() }));
afterEach(() => vi.clearAllMocks());

describe("首页热门内容接口", () => {
  it("广播兼容分页列表并过滤无效金额，保留服务端轮播顺序", async () => {
    const controller = new AbortController();
    vi.mocked(apiClient).mockResolvedValue({ code: "SUCCESS", data: { records: [
      { userId: 8, nickname: " 林晨 ", metricValue: "9999", avatar: "a.png" },
      { userId: 9, metricValue: "NaN" }, { metricValue: -1 }, { metricValue: null },
      null, { userId: 10, nickname: "", metricValue: 1888.4 },
    ] } });
    expect(await fetchHomeBroadcasts(controller.signal)).toEqual([
      { id: "0-8", nickname: "林晨", amount: 9999, avatar: "a.png" },
      { id: "4-10", nickname: "用户", amount: 1888, avatar: "" },
    ]);
    expect(apiClient).toHaveBeenCalledWith("/client/v1/rank/rechargeTop", { signal: controller.signal });
  });

  it("推荐榜请求全部游戏的每周接单榜，只展示三个有效用户", async () => {
    vi.mocked(apiClient).mockResolvedValue({ code: "SUCCESS", data: { list: [
      { userId: null }, { userId: "1", nickname: " A " }, { userId: -2 },
      { userId: 2 }, { userId: 3 }, { userId: 4 },
    ] } });
    expect((await fetchHomeHighlightRanking()).map((item) => item.id)).toEqual(["1", "2", "3"]);
    expect(apiClient).toHaveBeenCalledWith("/client/v1/rank/top?boardCode=ORDER_RECEIVE&rankType=WEEKLY&gameId=0", { signal: undefined });
  });

  it("热门俱乐部保留旧数据无 ID 的条目，过滤空名并限制三条", async () => {
    vi.mocked(apiClient).mockResolvedValue({ code: "SUCCESS", data: [
      { clubName: " " }, { id: 11, clubName: " 自营 ", logoUrl: "logo.png" },
      { clubName: "旧俱乐部" }, { id: 0, clubName: "待查询" }, { id: 14, clubName: "第四名" },
    ] });
    expect(await fetchHomeHighlightClubs()).toEqual([
      { id: "11", name: "自营", avatar: "logo.png" },
      { id: null, name: "旧俱乐部", avatar: "" }, { id: null, name: "待查询", avatar: "" },
    ]);
  });

  it("直接使用已有 ID，避免点击时重复请求", async () => {
    expect(await resolveHomeHighlightClub({ id: "18", name: "自营", avatar: "" })).toBe("18");
    expect(apiClient).not.toHaveBeenCalled();
  });

  it("旧俱乐部点击后按名称查询，优先匹配同名同头像", async () => {
    vi.mocked(apiClient).mockResolvedValue({ code: "SUCCESS", data: { records: [
      { id: 1, clubName: "自营", logoUrl: "old.png" },
      { id: 2, clubName: "自营", logoUrl: "new.png" },
      { id: 3, clubName: "其他", logoUrl: "new.png" },
    ] } });
    expect(await resolveHomeHighlightClub({ id: null, name: "自营", avatar: "new.png" })).toBe("2");
    expect(apiClient).toHaveBeenCalledWith("/client/v1/club/public/page", {
      method: "POST", body: { page: 1, pageSize: 20, action: { clubName: "自营" } }, signal: undefined,
    });
  });

  it("找不到匹配俱乐部时拒绝跳转到其他名称的俱乐部", async () => {
    vi.mocked(apiClient).mockResolvedValue({ code: "SUCCESS", data: { records: [{ id: 1, clubName: "其他" }] } });
    await expect(resolveHomeHighlightClub({ id: null, name: "自营", avatar: "" })).rejects.toThrow("未找到该俱乐部详情");
  });

  it("业务失败会抛错供卡片重试，正常空结果返回空列表", async () => {
    vi.mocked(apiClient).mockResolvedValueOnce({ code: "FAILED", info: "服务繁忙" }).mockResolvedValueOnce({ code: "SUCCESS", data: null });
    await expect(fetchHomeBroadcasts()).rejects.toThrow("服务繁忙");
    expect(await fetchHomeHighlightClubs()).toEqual([]);
  });
});
