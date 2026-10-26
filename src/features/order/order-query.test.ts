import { createRequire } from "node:module";
import { afterEach, expect, it, vi } from "vitest";
import { QueryObserver } from "@tanstack/react-query";
import { queryClient } from "@/core/query/query-client";

vi.mock("@/core/network/api-client", () => ({ apiClient: vi.fn() }));
// 在这类数据/缓存回归测试中，原生图片资源是不透明的句柄。
const require = createRequire(import.meta.url);
require.extensions[".svg"] = (module) => { module.exports = 1; };
const { apiClient } = await import("@/core/network/api-client");
const { mapOrder } = await import("./order.api");
const { invalidateOrderQueries, refreshStartedOrder } = await import("./order-query");

const raw = { id: 42, orderStatus: "ACCEPTED", quantity: 10, price: 330 };
const key = ["orders", "accept", "all", "51"];
const seed = () => ({ pages: [{ items: [mapOrder(raw, 0, "accept")], hasMore: false }], pageParams: [1] });
afterEach(() => { queryClient.clear(); vi.resetAllMocks(); });

it("updates status and actions from detail even when list refresh still returns ACCEPTED", async () => {
  queryClient.setQueryData(key, seed());
  const observer = new QueryObserver(queryClient, { queryKey: key, queryFn: async () => seed() });
  const unsubscribe = observer.subscribe(() => {});
  const otherAccount = ["orders", "accept", "all", "52"];
  queryClient.setQueryData(otherAccount, seed());
  const processing = ["orders", "accept", "inProgress", "51"];
  queryClient.setQueryData(processing, seed());
  vi.mocked(apiClient).mockResolvedValue({ code: "SUCCESS", data: {
    ...raw, orderStatus: "IN_SERVICE", serviceStartTime: new Date().toISOString(),
  } });

  await refreshStartedOrder("42", "test-session", "51");
  for (const updatedKey of [key, processing]) {
    const item = queryClient.getQueryData<ReturnType<typeof seed>>(updatedKey)!.pages[0].items[0];
    expect(item.status).toBe("inService");
    expect(item.statusLabel).toBe("服务中");
    expect(item.actions.map((action) => action.key)).toEqual(["free"]);
  }
  expect(queryClient.getQueryData<ReturnType<typeof seed>>(otherAccount)!.pages[0].items[0].status).toBe("waitingService");
  expect(apiClient).toHaveBeenCalledWith(expect.stringContaining("orderId=42"), expect.objectContaining({ token: "test-session" }));
  unsubscribe();
});

it("refetches active order lists when an order changes", async () => {
  queryClient.setQueryData(key, seed());
  const fetchPage = vi.fn(async () => seed());
  const observer = new QueryObserver(queryClient, { queryKey: key, queryFn: fetchPage });
  const unsubscribe = observer.subscribe(() => {});
  await invalidateOrderQueries("42");
  expect(fetchPage).toHaveBeenCalledTimes(1);
  unsubscribe();
});

it("does not invent a started status when detail refresh fails", async () => {
  queryClient.setQueryData(key, seed());
  vi.mocked(apiClient).mockRejectedValue(new Error("网络异常"));
  await expect(refreshStartedOrder("42", "test-session", "51")).rejects.toThrow("网络异常");
  expect(queryClient.getQueryData<ReturnType<typeof seed>>(key)!.pages[0].items[0].status).toBe("waitingService");
});
