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
const { invalidateOrderQueries, refreshOrdersForRemoteChange, refreshOrderAfterAction } = await import("./order-query");

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

  await refreshOrderAfterAction("42", "test-session", "51");
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

it("refetches the active order detail when a remote order notify arrives", async () => {
  const detailKey = ["order-detail", "42", "place"];
  queryClient.setQueryData(detailKey, { items: [] });
  const fetchDetail = vi.fn(async () => ({ items: [] }));
  const observer = new QueryObserver(queryClient, { queryKey: detailKey, queryFn: fetchDetail });
  const unsubscribe = observer.subscribe(() => {});
  await refreshOrdersForRemoteChange(["42", "DJ20261029133700217557"]);
  expect(fetchDetail).toHaveBeenCalledTimes(1);
  unsubscribe();
});

it("deduplicates repeated order identifiers from a remote notify", async () => {
  const detailKey = ["order-detail", "42", "place"];
  queryClient.setQueryData(detailKey, { items: [] });
  const fetchDetail = vi.fn(async () => ({ items: [] }));
  const observer = new QueryObserver(queryClient, { queryKey: detailKey, queryFn: fetchDetail });
  const unsubscribe = observer.subscribe(() => {});
  await refreshOrdersForRemoteChange(["42", "42"]);
  expect(fetchDetail).toHaveBeenCalledTimes(1);
  unsubscribe();
});

it("does not invent a started status when detail refresh fails", async () => {
  queryClient.setQueryData(key, seed());
  vi.mocked(apiClient).mockRejectedValue(new Error("网络异常"));
  await expect(refreshOrderAfterAction("42", "test-session", "51")).rejects.toThrow("网络异常");
  expect(queryClient.getQueryData<ReturnType<typeof seed>>(key)!.pages[0].items[0].status).toBe("waitingService");
});

it("keeps the accepted order in the all list but drops it from mismatched filters", async () => {
  queryClient.setQueryData(key, seed());
  const completed = ["orders", "accept", "completed", "51"];
  queryClient.setQueryData(completed, seed());
  vi.mocked(apiClient).mockResolvedValue({ code: "SUCCESS", data: { ...raw, orderStatus: "ACCEPTED" } });

  await refreshOrderAfterAction("42", "test-session", "51");
  const allItems = queryClient.getQueryData<ReturnType<typeof seed>>(key)!.pages[0].items;
  expect(allItems).toHaveLength(1);
  expect(allItems[0].status).toBe("waitingService");
  expect(allItems[0].actions.map((action) => action.key)).toEqual(["start"]);
  expect(queryClient.getQueryData<ReturnType<typeof seed>>(completed)!.pages[0].items).toHaveLength(0);
});

it("replaces the card with filter-specific labels after an action", async () => {
  const inProgress = ["orders", "accept", "inProgress", "51"];
  queryClient.setQueryData(inProgress, seed());
  vi.mocked(apiClient).mockResolvedValue({ code: "SUCCESS", data: {
    ...raw, orderStatus: "IN_SERVICE", serviceStartTime: new Date().toISOString(),
  } });

  await refreshOrderAfterAction("42", "test-session", "51");
  const item = queryClient.getQueryData<ReturnType<typeof seed>>(inProgress)!.pages[0].items[0];
  expect(item.statusLabel).toBe("服务中");
});

it("marks the finished order completed with a free action on the accept side", async () => {
  queryClient.setQueryData(key, seed());
  const inProgress = ["orders", "accept", "inProgress", "51"];
  queryClient.setQueryData(inProgress, seed());
  vi.mocked(apiClient).mockResolvedValue({ code: "SUCCESS", data: { ...raw, orderStatus: "COMPLETED" } });

  await refreshOrderAfterAction("42", "test-session", "51");
  const allItems = queryClient.getQueryData<ReturnType<typeof seed>>(key)!.pages[0].items;
  expect(allItems).toHaveLength(1);
  expect(allItems[0].status).toBe("completed");
  expect(allItems[0].statusLabel).toBe("已完成");
  expect(allItems[0].actions.map((action) => action.key)).toEqual(["free"]);
  expect(queryClient.getQueryData<ReturnType<typeof seed>>(inProgress)!.pages[0].items).toHaveLength(0);
});
