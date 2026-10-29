import { describe, expect, it, vi } from "vitest";

vi.mock("@/core/logging/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn() } }));
vi.mock("@/features/message/rongcloud-im", () => ({
  subscribeRongMessageEvents: vi.fn(() => () => undefined),
}));
vi.mock("./order-query", () => ({ refreshOrdersForRemoteChange: vi.fn(async () => undefined) }));

const { handleOrderNotifyMessage, orderNotifyTargets } = await import("./order-notify-sync");
const { refreshOrdersForRemoteChange } = await import("./order-query");

const notify = {
  id: "n1",
  kind: "orderNotify",
  title: "陪玩师已接单",
  orderId: "42",
  orderNo: "DJ20261029133700217557",
  time: "13:37",
  isMine: false,
  status: "sent",
  sentAt: 1,
} as const;

const textMessage = {
  id: "t1",
  kind: "text",
  text: "hello",
  time: "13:37",
  isMine: false,
  status: "sent",
  sentAt: 1,
} as const;

describe("order notify sync", () => {
  it("ignores messages that are not order notifications", () => {
    expect(orderNotifyTargets(textMessage)).toEqual([]);
    handleOrderNotifyMessage("50000002", textMessage);
    expect(refreshOrdersForRemoteChange).not.toHaveBeenCalled();
  });

  it("refreshes order caches with both the order id and order no", () => {
    expect(orderNotifyTargets(notify)).toEqual(["42", "DJ20261029133700217557"]);
    handleOrderNotifyMessage("50000002", notify);
    expect(refreshOrdersForRemoteChange).toHaveBeenCalledWith(["42", "DJ20261029133700217557"]);
  });

  it("falls back to the order number alone when the order id is missing", () => {
    expect(orderNotifyTargets({ ...notify, orderId: undefined })).toEqual(["DJ20261029133700217557"]);
  });
});
