import { afterEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/core/network/api-client";
import { StarNotEnoughError } from "@/features/match/api/match.api";

import { payCompanionOrder } from "./companion-order.api";

vi.mock("@/core/network/api-client", () => ({ apiClient: vi.fn() }));
vi.mock("@/features/mine/blacklist", () => ({ isUserBlacklisted: vi.fn() }));

afterEach(() => vi.clearAllMocks());

describe("订单支付：余额不足错误码映射", () => {
  it("STAR_NOT_ENOUGH 抛出 StarNotEnoughError，供支付弹窗引导充值", async () => {
    vi.mocked(apiClient).mockResolvedValue({
      code: "STAR_NOT_ENOUGH",
      info: "钻石余额不足",
    });

    const error = await payCompanionOrder(1, "token").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(StarNotEnoughError);
    expect((error as Error).message).toBe("钻石余额不足");
  });

  it("其他失败码仍抛普通错误", async () => {
    vi.mocked(apiClient).mockResolvedValue({
      code: "ORDER_PAID",
      info: "订单已支付",
    });

    await expect(payCompanionOrder(1, "token")).rejects.toThrow("订单已支付");
  });

  it("成功时不抛错", async () => {
    vi.mocked(apiClient).mockResolvedValue({ code: "SUCCESS" });

    await expect(payCompanionOrder(1, "token")).resolves.toBeUndefined();
  });
});
