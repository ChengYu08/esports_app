import { createRequire } from "node:module";
import { afterEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/core/network/api-client";

vi.mock("@/core/network/api-client", () => ({ apiClient: vi.fn() }));
// 映射测试只需要图片资源句柄，无需加载原生图片。
const require = createRequire(import.meta.url);
require.extensions[".svg"] = (module) => {
  module.exports = 1;
};
const {
  fetchDispatchPage,
  fetchDispatchDetail,
  grabDispatchRequest,
  isActivityDispatchRequest,
} = await import("./dispatch.api");

afterEach(() => vi.clearAllMocks());

describe("派单中心列表：活动字段映射", () => {
  it("available/page 活动需求输出活动标识，普通映射行为不变", async () => {
    vi.mocked(apiClient).mockResolvedValue({
      code: "SUCCESS",
      data: {
        records: [
          {
            requestNo: "QM1",
            publishSource: "ACTIVITY",
            activityId: 10086,
            activityCode: " SECKILL001 ",
            activityType: "SECKILL",
            cardItems: [{ label: "活动价", value: { text: "9.9 星钻/小时" } }],
            discountAmount: 5,
            realPayAmount: 9.9,
            maxSelectableCount: 1,
            modeName: "排位",
            maleUnitPrice: 9.9,
            quantity: 1,
          },
        ],
        total: 1,
      },
    });

    const result = await fetchDispatchPage("grabbing", "token", 1);

    expect(apiClient).toHaveBeenCalledWith(
      "/client/v1/quickMatch/available/page",
      {
        method: "POST",
        token: "token",
        body: { page: 1, pageSize: 10, action: {} },
        signal: undefined,
      },
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      requestNo: "QM1",
      unitPrice: "9.9",
      activityTag: "活动",
    });
  });

  it("available/page 普通需求（activityCode 为空）不输出活动标识", async () => {
    vi.mocked(apiClient).mockResolvedValue({
      code: "SUCCESS",
      data: {
        records: [{ requestNo: "QM2", activityCode: "  ", modeName: "排位" }],
        total: 1,
      },
    });

    const result = await fetchDispatchPage("grabbing", "token", 2);

    expect(result.items[0].activityTag).toBeUndefined();
  });

  it("grab/my/page 嵌套 request 活动需求输出活动标识", async () => {
    vi.mocked(apiClient).mockResolvedValue({
      code: "SUCCESS",
      data: {
        records: [
          {
            id: 91,
            grabStatus: "GRABBED",
            request: {
              requestNo: "QM3",
              publishSource: "ACTIVITY",
              activityCode: "SECKILL001",
              cardItems: [
                { label: "活动名称", value: { text: "电竞大神秒杀" } },
              ],
            },
          },
          { id: 92, grabStatus: "SUCCESS", request: { requestNo: "QM4" } },
        ],
        total: 2,
      },
    });

    const result = await fetchDispatchPage("history", "token", 1);

    expect(result.items[0]).toMatchObject({
      id: "history-91",
      requestNo: "QM3",
      activityTag: "活动",
    });
    expect(result.items[1].activityTag).toBeUndefined();
  });
});

describe("派单详情/抢单响应：活动字段透传", () => {
  it("fetchDispatchDetail 透传活动字段", async () => {
    const data = {
      requestNo: "QM1",
      publishSource: "ACTIVITY",
      activityId: 10086,
      activityCode: "SECKILL001",
      activityType: "SECKILL",
      cardItems: [{ label: "活动价", value: { text: "9.9 星钻/小时" } }],
      discountAmount: 5,
      realPayAmount: 9.9,
      maxSelectableCount: 1,
    };
    vi.mocked(apiClient).mockResolvedValue({ code: "SUCCESS", data });

    const detail = await fetchDispatchDetail("QM1", "token");

    expect(apiClient).toHaveBeenCalledWith(
      "/client/v1/quickMatch/detail?requestNo=QM1",
      { method: "GET", token: "token", signal: undefined },
    );
    expect(detail).toMatchObject(data);
  });

  it("grabDispatchRequest 透传活动字段（普通需求不输出）", async () => {
    vi.mocked(apiClient).mockResolvedValue({
      code: "SUCCESS",
      data: {
        requestNo: "QM5",
        publishSource: "ACTIVITY",
        activityCode: "SECKILL001",
        cardItems: [{ label: "活动名称", value: { text: "电竞大神秒杀" } }],
        maxSelectableCount: 1,
      },
    });

    const grabbed = await grabDispatchRequest("QM5", "token");

    expect(apiClient).toHaveBeenCalledWith("/client/v1/quickMatch/grab", {
      method: "POST",
      token: "token",
      body: { action: { requestNo: "QM5" } },
      suppressRealNameRedirect: true,
    });
    expect(grabbed).toMatchObject({
      requestNo: "QM5",
      activityCode: "SECKILL001",
      cardItems: [{ label: "活动名称", value: { text: "电竞大神秒杀" } }],
    });

    vi.mocked(apiClient).mockResolvedValue({
      code: "SUCCESS",
      data: { requestNo: "QM6", activityCode: "" },
    });
    const plainGrabbed = await grabDispatchRequest("QM6", "token");
    expect(plainGrabbed.activityCode).toBe("");
  });
});

describe("isActivityDispatchRequest：activityCode 非空即活动需求", () => {
  it.each([
    [null, false],
    [undefined, false],
    [{ activityCode: "" }, false],
    [{ activityCode: "   " }, false],
    [{ activityCode: "SECKILL001" }, true],
    [{ activityCode: " SECKILL001 " }, true],
  ])("判定用例 %j → %j", (request, expected) => {
    expect(isActivityDispatchRequest(request as never)).toBe(expected);
  });
});
