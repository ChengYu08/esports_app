import { afterEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/core/network/api-client";
import { fetchActivityDetail, publishActivity } from "./activity.api";

vi.mock("@/core/network/api-client", () => ({ apiClient: vi.fn() }));

afterEach(() => vi.clearAllMocks());

describe("秒杀活动详情接口", () => {
  it("公开接口不带 token，请求体为 {action:{activityCode}}", async () => {
    vi.mocked(apiClient).mockResolvedValue({ code: "SUCCESS", data: {} });

    await fetchActivityDetail("SECKILL001");

    expect(apiClient).toHaveBeenCalledWith("/client/v1/activity/detail", {
      method: "POST",
      body: { action: { activityCode: "SECKILL001" } },
      signal: undefined,
    });
  });

  it("映射详情字段：activityId 转字符串，金额转数字，股票数量不小于 0", async () => {
    vi.mocked(apiClient).mockResolvedValue({
      code: "SUCCESS",
      data: {
        activityId: 10086,
        activityCode: " SECKILL001 ",
        mainTitle: " 电竞陪玩秒杀 ",
        subTitle: "限时 5 折",
        displayTag: " 限时秒杀 ",
        actionText: " 马上抢 ",
        rules: "<p>活动规则</p>",
        startTime: "2026-10-20T10:00:00+08:00",
        endTime: "2026-10-20T12:00:00+08:00",
        serverTime: "2026-10-20T09:00:00+08:00",
        product: { originalPrice: "20.00", activityPrice: 9.9, billingUnitName: " 小时 " },
        stock: { remainingStock: 8 },
        buttonStatus: "ACTIVE",
        disabledReason: "  ",
      },
    });

    const detail = await fetchActivityDetail("SECKILL001");

    expect(detail).toEqual({
      activityId: "10086",
      activityCode: "SECKILL001",
      mainTitle: "电竞陪玩秒杀",
      subTitle: "限时 5 折",
      displayTag: "限时秒杀",
      actionText: "马上抢",
      rules: "<p>活动规则</p>",
      startTime: "2026-10-20T10:00:00+08:00",
      endTime: "2026-10-20T12:00:00+08:00",
      serverTime: "2026-10-20T09:00:00+08:00",
      product: { originalPrice: 20, activityPrice: 9.9, billingUnitName: "小时" },
      remainingStock: 8,
      buttonStatus: "ACTIVE",
      disabledReason: undefined,
    });
  });

  it("displayTag/actionText 缺省时使用默认值，金额/库存缺失时兜底 0", async () => {
    vi.mocked(apiClient).mockResolvedValue({
      code: "SUCCESS",
      data: {
        activityId: "1",
        activityCode: "SECKILL001",
        mainTitle: "标题",
        subTitle: "",
        rules: "",
        product: null,
        stock: null,
        buttonStatus: "ACTIVE",
      },
    });

    const detail = await fetchActivityDetail("SECKILL001");

    expect(detail.displayTag).toBe("活动");
    expect(detail.actionText).toBe("立即参与");
    expect(detail.product).toEqual({ originalPrice: 0, activityPrice: 0, billingUnitName: "" });
    expect(detail.remainingStock).toBe(0);
  });

  it("信封 code 非 SUCCESS 时抛出后端 info", async () => {
    vi.mocked(apiClient).mockResolvedValue({ code: "FAILED", info: "活动不存在" });

    await expect(fetchActivityDetail("SECKILL001")).rejects.toThrow("活动不存在");
  });

  it.each([undefined, null])("成功包络 data 缺失（%j）时兜底抛错，不返回残缺数据", async (data) => {
    vi.mocked(apiClient).mockResolvedValue({ code: "SUCCESS", data });

    await expect(fetchActivityDetail("SECKILL001")).rejects.toThrow("活动信息加载失败");
  });
});

describe("参与活动（发布活动派单）接口", () => {
  it("需登录接口显式携带 token，请求体为 {action:{activityId}}", async () => {
    vi.mocked(apiClient).mockResolvedValue({
      code: "SUCCESS",
      data: { requestNo: "REQ001", roomId: 9001, roomVersion: 3, expireTime: "2026-10-20T12:00:00+08:00" },
    });

    await publishActivity("10086", "token-abc");

    expect(apiClient).toHaveBeenCalledWith("/client/v1/activity/publish", {
      method: "POST",
      token: "token-abc",
      body: { action: { activityId: 10086 } },
      signal: undefined,
    });
  });

  it("映射发布结果，roomId/roomVersion 为空时保留 null", async () => {
    vi.mocked(apiClient).mockResolvedValue({
      code: "SUCCESS",
      data: { requestNo: "REQ001", roomId: null, roomVersion: null, expireTime: "" },
    });

    expect(await publishActivity("1", "token-abc")).toEqual({
      requestNo: "REQ001",
      roomId: null,
      roomVersion: null,
      expireTime: "",
    });
  });

  it("requestNo 缺失视为发布失败，兜底抛错", async () => {
    vi.mocked(apiClient).mockResolvedValue({ code: "SUCCESS", data: {} });

    await expect(publishActivity("1", "token-abc")).rejects.toThrow("参与活动失败");
  });

  it("信封业务失败时抛出后端 info", async () => {
    vi.mocked(apiClient).mockResolvedValue({ code: "NOT_LOGGED_IN", info: "请先登录" });

    await expect(publishActivity("1", "token-abc")).rejects.toThrow("请先登录");
  });
});
