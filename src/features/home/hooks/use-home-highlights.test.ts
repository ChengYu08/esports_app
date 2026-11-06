import { createRequire } from "node:module";
import { createElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { fetchHomeBroadcasts, fetchHomeHighlightClubs, fetchHomeHighlightRanking } from "../api/home-highlights.api";
import { useHomeHighlights } from "./use-home-highlights";

const { listeners } = vi.hoisted(() => {
  // React Query 在服务端不启用轮询，测试中模拟移动端运行环境。
  Object.assign(globalThis, { window: { addEventListener() {}, removeEventListener() {} } });
  return { listeners: new Set<(state: string) => void>() };
});
vi.mock("react-native", () => ({ AppState: {
  currentState: "active",
  addEventListener: (_event: string, callback: (state: string) => void) => {
    listeners.add(callback);
    return { remove: () => listeners.delete(callback) };
  },
} }));
vi.mock("../api/home-highlights.api", () => ({
  fetchHomeBroadcasts: vi.fn(async () => []),
  fetchHomeHighlightClubs: vi.fn(async () => []),
  fetchHomeHighlightRanking: vi.fn(async () => []),
}));

const { act, create } = createRequire(import.meta.url)("react-test-renderer");
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); listeners.clear(); });

function Harness({ visible }: { visible: boolean }) {
  useHomeHighlights(visible);
  return null;
}

it("只在首页前台轮询广播，恢复前台和切回首页立即刷新，卸载后清理监听", async () => {
  vi.useFakeTimers();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 } } });
  const tree = (visible: boolean) => createElement(QueryClientProvider, { client }, createElement(Harness, { visible }));
  let renderer: ReturnType<typeof create>;
  await act(async () => { renderer = create(tree(true)); });
  expect(fetchHomeBroadcasts).toHaveBeenCalledTimes(1);
  expect(fetchHomeHighlightRanking).toHaveBeenCalledTimes(1);
  expect(fetchHomeHighlightClubs).toHaveBeenCalledTimes(1);
  await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
  expect(fetchHomeBroadcasts).toHaveBeenCalledTimes(2);
  await act(async () => { listeners.forEach((listener) => listener("background")); });
  await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
  expect(fetchHomeBroadcasts).toHaveBeenCalledTimes(2);
  await act(async () => { listeners.forEach((listener) => listener("active")); });
  expect(fetchHomeBroadcasts).toHaveBeenCalledTimes(3);
  await act(async () => { renderer.update(tree(false)); });
  await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
  expect(fetchHomeBroadcasts).toHaveBeenCalledTimes(3);
  await act(async () => { renderer.update(tree(true)); });
  expect(fetchHomeBroadcasts).toHaveBeenCalledTimes(4);
  await act(async () => { renderer.unmount(); });
  expect(listeners.size).toBe(0);
  client.clear();
});
