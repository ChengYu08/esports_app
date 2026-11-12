import { createRequire } from "node:module";
import { createElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { QuickMatchGrabItem } from "@/features/match/api/match.types";
import { fetchProfileDetail } from "@/features/mine/api/profile.api";
import { useProfileDetail } from "@/features/mine/hooks/use-profile-data";
import { useMatchCandidateProfile } from "./use-match-candidate-profile";

const focus = vi.hoisted(() => ({ current: true }));
vi.mock("expo-router", () => ({ useIsFocused: () => focus.current }));
vi.mock("@/features/mine/api/profile.api", () => ({
  fetchProfileDetail: vi.fn(),
  fetchProfileGameDetail: vi.fn(),
  fetchProfileReviews: vi.fn(),
}));

const { act, create } = createRequire(import.meta.url)("react-test-renderer") as typeof import("react-test-renderer");
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const candidate: QuickMatchGrabItem = {
  id: "grab-1", requestNo: "QM1", companionUserId: "11", clubId: "9", nickname: "陪玩", sex: 0,
};
const queryKey = ["profile-detail", "9", "11"];
let client: QueryClient;
let renderer: ReturnType<typeof create> | undefined;

function Candidate({ item = candidate }: { item?: QuickMatchGrabItem }) {
  const { data } = useMatchCandidateProfile(item);
  return createElement("signature", null, data?.signature);
}

function Profile() {
  useProfileDetail({ clubId: "9", userId: "11" });
  return null;
}

function tree(child = createElement(Candidate)) {
  return createElement(QueryClientProvider, { client }, child);
}

describe("选人卡片资料刷新", () => {
  beforeEach(() => {
    focus.current = true;
    vi.resetAllMocks();
    client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 } } });
    client.setQueryData(queryKey, { signature: "旧签名" });
    vi.mocked(fetchProfileDetail).mockImplementation(async () => ({ signature: "新签名" }) as Awaited<ReturnType<typeof fetchProfileDetail>>);
  });

  afterEach(async () => {
    await act(async () => { renderer?.unmount(); });
    renderer = undefined;
    client.clear();
  });

  it("即使30秒内缓存仍新鲜，进入选人页也更新资料", async () => {
    await act(async () => { renderer = create(tree()); });
    expect(fetchProfileDetail).toHaveBeenCalledTimes(1);
    expect(client.getQueryData(queryKey)).toEqual({ signature: "新签名" });
  });

  it("页面未卸载时，连续离开再返回两次都会刷新，普通重渲染不重复请求", async () => {
    await act(async () => { renderer = create(tree()); });
    await act(async () => { renderer?.update(tree()); });
    expect(fetchProfileDetail).toHaveBeenCalledTimes(1);
    for (let count = 0; count < 2; count += 1) {
      focus.current = false;
      await act(async () => { renderer?.update(tree()); });
      expect(fetchProfileDetail).toHaveBeenCalledTimes(count + 1);
      focus.current = true;
      await act(async () => { renderer?.update(tree()); });
      expect(fetchProfileDetail).toHaveBeenCalledTimes(count + 2);
    }
  });

  it("退出卸载后马上重新进入也刷新", async () => {
    await act(async () => { renderer = create(tree()); });
    await act(async () => { renderer?.unmount(); });
    await act(async () => { renderer = create(tree()); });
    expect(fetchProfileDetail).toHaveBeenCalledTimes(2);
  });

  it("刷新失败保留已有资料", async () => {
    vi.mocked(fetchProfileDetail).mockRejectedValue(new Error("网络失败"));
    await act(async () => { renderer = create(tree()); });
    expect(fetchProfileDetail).toHaveBeenCalledTimes(1);
    expect(client.getQueryData(queryKey)).toEqual({ signature: "旧签名" });
  });

  it("缺少陪玩用户编号时不请求资料", async () => {
    await act(async () => {
      renderer = create(tree(createElement(Candidate, { item: { ...candidate, companionUserId: undefined } })));
    });
    expect(fetchProfileDetail).not.toHaveBeenCalled();
  });

  it("其他个人资料页面继续使用原有的30秒缓存", async () => {
    await act(async () => { renderer = create(tree(createElement(Profile))); });
    expect(fetchProfileDetail).not.toHaveBeenCalled();
  });
});
