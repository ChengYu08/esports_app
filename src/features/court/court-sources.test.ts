import { beforeEach, describe, expect, it, vi } from "vitest";
import { AbortController as NativeAbortController } from "abort-controller";
import { courtApi, type CourtSource } from "./court.api";
import { confirmCourtSource, courtReviewsForOrder, courtSourceGameIcon, filterCourtOrders, groupCourtOrders, loadCourtSources } from "./court-sources";
import { useCourtSourceSelection } from "./court-source-selection";

const auth = vi.hoisted(() => ({ accessToken: "test-token" as string | null }));
vi.mock("@esports/auth", () => ({ useAuthStore: { getState: () => auth } }));
vi.mock("./court.api", () => ({
  courtApi: { getSourcePage: vi.fn(), previewSource: vi.fn() },
  pageRecords: (page: { records?: CourtSource[]; list?: CourtSource[] }) => page.records ?? page.list ?? [],
}));

const reviewA: CourtSource = { orderId: 100, orderNo: "202610220001", reviewId: 1, reviewRating: 1, reviewContent: "评价 A" };
const reviewB: CourtSource = { orderId: "100", orderNo: "202610220001", reviewId: 2, reviewRating: 2, reviewContent: "评价 B" };
const reviewC: CourtSource = { orderId: 987, orderNo: "202610220002", reviewId: 3 };

beforeEach(() => {
  vi.resetAllMocks();
  auth.accessToken = "test-token";
  useCourtSourceSelection.setState({ sessions: {} });
});

describe("court order and review sources", () => {
  const games = [
    { id: 1, name: "三角洲行动端游", iconUrl: "https://cdn.example.com/pc.png" },
    { id: 2, name: "三角洲行动手游", iconUrl: "https://cdn.example.com/mobile.png" },
  ];
  it("prefers the source icon and resolves protocol-relative URLs", () => {
    expect(courtSourceGameIcon({ gameIconUrl: " //cdn.example.com/order.png ", gameId: 1 }, games)).toBe("https://cdn.example.com/order.png");
  });
  it("matches game IDs across string and number representations", () => {
    expect(courtSourceGameIcon({ gameId: "2", gameName: "旧游戏名" }, games)).toBe(games[1].iconUrl);
  });
  it("fills missing source icons from an exact game name without confusing PC and mobile", () => {
    expect(courtSourceGameIcon({ gameName: " 三角洲行动端游 " }, games)).toBe(games[0].iconUrl);
    expect(courtSourceGameIcon({ gameName: "三角洲行动" }, games)).toBeUndefined();
  });
  it("leaves missing, ambiguous and unmatched game data on the fallback", () => {
    expect(courtSourceGameIcon({}, games)).toBeUndefined();
    expect(courtSourceGameIcon({ gameName: games[0].name })).toBeUndefined();
    expect(courtSourceGameIcon({ gameId: 99, gameName: games[0].name }, games)).toBeUndefined();
    expect(courtSourceGameIcon({ gameName: games[0].name }, [games[0], { ...games[0], id: 3 }])).toBeUndefined();
  });
  it("groups repeated orders while keeping all their eligible reviews", () => {
    expect(groupCourtOrders([reviewA, reviewB, reviewC])).toEqual([reviewA, reviewC]);
    expect(courtReviewsForOrder([reviewA, reviewB, reviewC], "100")).toEqual([reviewA, reviewB]);
  });
  it("matches either order ID or a partial order number, including whitespace", () => {
    const orders = groupCourtOrders([reviewA, reviewB, reviewC]);
    expect(filterCourtOrders(orders, " 987 ")).toEqual([reviewC]);
    expect(filterCourtOrders(orders, "220001")).toEqual([reviewA]);
    expect(filterCourtOrders(orders, "missing")).toEqual([]);
    expect(filterCourtOrders(orders, "  ")).toEqual(orders);
  });
  it("loads later pages before searching or selecting an order's reviews", async () => {
    vi.mocked(courtApi.getSourcePage)
      .mockResolvedValueOnce({ records: [reviewA], pages: 2 })
      .mockResolvedValueOnce({ list: [reviewB, reviewC], totalPages: 2 });
    const sources = await loadCourtSources("DELETE_REVIEW", "test-token");
    expect(courtReviewsForOrder(sources, "100")).toEqual([reviewA, reviewB]);
    expect(filterCourtOrders(groupCourtOrders(sources), "987")).toEqual([reviewC]);
    expect(courtApi.getSourcePage).toHaveBeenLastCalledWith("DELETE_REVIEW", 2, 20, undefined);
  });
  it("uses total when page count is absent", async () => {
    vi.mocked(courtApi.getSourcePage)
      .mockResolvedValueOnce({ records: [reviewA], total: 21 })
      .mockResolvedValueOnce({ records: [reviewB], total: 21 });
    expect(await loadCourtSources("DELETE_REVIEW", "test-token")).toEqual([reviewA, reviewB]);
  });
  it("does not loop forever when the server repeats a page", async () => {
    vi.mocked(courtApi.getSourcePage).mockResolvedValue({ records: [reviewA], pages: 3 });
    await expect(loadCourtSources("DELETE_REVIEW", "test-token")).rejects.toThrow("订单列表加载异常");
    expect(courtApi.getSourcePage).toHaveBeenCalledTimes(2);
  });
  it("does not present a partial result as a complete search after a page fails", async () => {
    vi.mocked(courtApi.getSourcePage)
      .mockResolvedValueOnce({ records: [reviewA], pages: 2 })
      .mockRejectedValueOnce(new Error("网络异常"));
    await expect(loadCourtSources("DELETE_REVIEW", "test-token")).rejects.toThrow("网络异常");
  });
  it("cancels paging when the picker is unmounted", async () => {
    const controller = new AbortController();
    vi.mocked(courtApi.getSourcePage).mockImplementation(async () => {
      controller.abort();
      return { records: [reviewA], pages: 2 };
    });
    await expect(loadCourtSources("DELETE_REVIEW", "test-token", controller.signal)).rejects.toThrow();
    expect(courtApi.getSourcePage).toHaveBeenCalledTimes(1);
  });
  it("supports React Native's AbortSignal without throwIfAborted", async () => {
    const controller = new NativeAbortController();
    const signal = controller.signal as AbortSignal;
    vi.mocked(courtApi.getSourcePage).mockResolvedValue({ records: [reviewA], total: 1 });
    expect(await loadCourtSources("DELETE_REVIEW", "test-token", signal)).toEqual([reviewA]);
    controller.abort();
    await expect(loadCourtSources("DELETE_REVIEW", "test-token", signal)).rejects.toThrow("加载已取消");
    expect(courtApi.getSourcePage).toHaveBeenCalledTimes(1);
  });
  it("rejects data returned after the account changes", async () => {
    vi.mocked(courtApi.getSourcePage).mockImplementation(async () => {
      auth.accessToken = "another-token";
      return { records: [reviewA], pages: 2 };
    });
    await expect(loadCourtSources("DELETE_REVIEW", "test-token")).rejects.toThrow("登录状态已变化");
    expect(courtApi.getSourcePage).toHaveBeenCalledTimes(1);
  });
});

describe("confirming an order or review", () => {
  it("previews deletion by review ID and preserves its order for the form", async () => {
    vi.mocked(courtApi.previewSource).mockResolvedValue({ reviewId: 2, reviewContent: "最新评价内容" });
    expect(await confirmCourtSource("DELETE_REVIEW", reviewB, "test-token"))
      .toMatchObject({ orderId: "100", reviewId: 2, reviewContent: "最新评价内容" });
    expect(courtApi.previewSource).toHaveBeenCalledExactlyOnceWith({ caseType: "DELETE_REVIEW", orderId: undefined, reviewId: 2 });
  });
  it.each(["RETRAIN", "APOLOGY", "FINE"] as const)("previews %s by order ID without carrying a review ID", async (caseType) => {
    vi.mocked(courtApi.previewSource).mockResolvedValue({ orderId: 100 });
    expect(await confirmCourtSource(caseType, reviewA, "test-token")).toMatchObject({ orderId: 100, reviewId: undefined });
    expect(courtApi.previewSource).toHaveBeenCalledExactlyOnceWith({ caseType, orderId: 100, reviewId: undefined });
  });
  it("does not confirm an order alone when deleting a review", async () => {
    await expect(confirmCourtSource("DELETE_REVIEW", { orderId: 100 }, "test-token")).rejects.toThrow("请选择完整");
    expect(courtApi.previewSource).not.toHaveBeenCalled();
  });
  it("keeps preview errors visible instead of silently accepting an invalid source", async () => {
    vi.mocked(courtApi.previewSource).mockRejectedValue(new Error("该评价已不可投诉"));
    await expect(confirmCourtSource("DELETE_REVIEW", reviewA, "test-token")).rejects.toThrow("该评价已不可投诉");
  });
  it("rejects a preview for another review", async () => {
    vi.mocked(courtApi.previewSource).mockResolvedValue(reviewC);
    await expect(confirmCourtSource("DELETE_REVIEW", reviewA, "test-token")).rejects.toThrow("信息已变化");
  });
});

describe("selection sessions", () => {
  it("keeps drafts separate from the form until confirmation", () => {
    const store = useCourtSourceSelection.getState();
    store.begin("form", "DELETE_REVIEW", "test-token", reviewA);
    store.selectReview("form", "2");
    expect(useCourtSourceSelection.getState().sessions.form.confirmedSource).toBeNull();
    expect(store.confirm("form", reviewB, "test-token")).toBe(true);
    expect(useCourtSourceSelection.getState().sessions.form.confirmedSource).toEqual(reviewB);
  });
  it("clears the previous review when selecting a different order", () => {
    const store = useCourtSourceSelection.getState();
    store.begin("form", "DELETE_REVIEW", "test-token", reviewA);
    store.selectOrder("form", "987");
    expect(useCourtSourceSelection.getState().sessions.form.reviewId).toBeNull();
    expect(store.confirm("form", reviewA, "test-token")).toBe(false);
  });
  it("canceling or reopening restores the form's confirmed source", () => {
    const store = useCourtSourceSelection.getState();
    store.begin("form", "DELETE_REVIEW", "test-token", reviewA);
    store.selectOrder("form", "987");
    store.begin("form", "DELETE_REVIEW", "test-token", reviewA);
    expect(useCourtSourceSelection.getState().sessions.form).toMatchObject({ orderId: "100", reviewId: "1", confirmedSource: null });
  });
  it("isolates forms and rejects confirmation after disposal or account change", () => {
    const store = useCourtSourceSelection.getState();
    store.begin("first", "DELETE_REVIEW", "test-token", reviewA);
    store.begin("second", "DELETE_REVIEW", "test-token", reviewC);
    expect(store.confirm("first", reviewA, "another-token")).toBe(false);
    store.remove("first");
    expect(store.confirm("first", reviewA, "test-token")).toBe(false);
    expect(useCourtSourceSelection.getState().sessions.second.orderId).toBe("987");
  });
});
