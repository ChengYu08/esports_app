import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";
import { parseServerDateTime } from "@/shared/time/server-date";
import { formatPaymentCountdown, getPaymentDeadline } from "./payment-countdown";

vi.mock("@/core/network/api-client", () => ({ apiClient: vi.fn() }));
const require = createRequire(import.meta.url);
require.extensions[".svg"] = (module) => { module.exports = 1; };
const { mapOrder } = await import("./order.api");

describe("待支付订单倒计时", () => {
  const createdAt = parseServerDateTime("2026-11-03 10:00:00");

  it("普通待支付列表订单按创建时间加五分钟计算，不随再次进入重置", () => {
    const order = mapOrder({ id: 1, orderStatus: "PENDING_PAY", createTime: "2026-11-03 10:00:00" });
    const deadline = getPaymentDeadline(order)!;
    expect(formatPaymentCountdown(deadline, createdAt)).toBe("05:00");
    expect(formatPaymentCountdown(deadline, createdAt + 32_000)).toBe("04:28");
    expect(formatPaymentCountdown(deadline, createdAt + 180_000)).toBe("02:00");
  });

  it("保留并优先使用服务端截止时间", () => {
    const order = mapOrder({ id: 1, orderStatus: "PENDING_PAY", createTime: "2026-11-03 10:00:00", payDeadline: "2026-11-03 10:10:00" });
    expect(order.payDeadline).toBe("2026-11-03 10:10:00");
    expect(formatPaymentCountdown(getPaymentDeadline(order)!, createdAt + 32_000)).toBe("09:28");
  });

  it("后台停留后按实际经过时间计算，到期后不出现负数", () => {
    const deadline = createdAt + 300_000;
    expect(formatPaymentCountdown(deadline, deadline - 1)).toBe("00:01");
    expect(formatPaymentCountdown(deadline, deadline)).toBe("00:00");
    expect(formatPaymentCountdown(deadline, deadline + 600_000)).toBe("00:00");
  });

  it("支付完成或取消后不显示倒计时", () => {
    for (const orderStatus of ["PAID", "CANCELED", "COMPLETED"]) {
      expect(getPaymentDeadline(mapOrder({ id: 1, orderStatus, createTime: "2026-11-03 10:00:00" }))).toBeNull();
    }
  });

  it("时间缺失或非法时保留正常支付入口，不展示错误倒计时", () => {
    for (const createTime of [undefined, "", "invalid"]) {
      expect(getPaymentDeadline(mapOrder({ id: 1, orderStatus: "PENDING_PAY", createTime }))).toBeNull();
    }
  });
});
