import type { Game } from "@/features/home/api/home.types";
import { useAuthStore } from "@esports/auth";
import {
  courtApi,
  pageRecords,
  type CourtCaseType,
  type CourtSource,
  type Page,
} from "./court.api";

const PAGE_SIZE = 20;

export function courtSourceGameIcon(source: CourtSource, games: Game[] = []) {
  let uri = source.gameIconUrl?.trim();
  if (!uri) {
    const matches =
      source.gameId != null
        ? games.filter((game) => String(game.id) === String(source.gameId))
        : games.filter(
            (game) =>
              Boolean(source.gameName?.trim()) &&
              game.name.trim() === source.gameName?.trim(),
          );
    if (matches.length === 1) {
      uri = matches[0].iconUrl?.trim();
    }
  }
  return uri?.startsWith("//") ? `https:${uri}` : uri || undefined;
}

export function courtSourceKey(source: CourtSource) {
  return `${source.orderId ?? ""}:${source.reviewId ?? ""}`;
}

export function groupCourtOrders(sources: CourtSource[]) {
  const orders = new Map<string, CourtSource>();
  for (const source of sources) {
    if (source.orderId != null && !orders.has(String(source.orderId))) {
      orders.set(String(source.orderId), source);
    }
  }
  return Array.from(orders.values());
}

export function filterCourtOrders(orders: CourtSource[], keyword: string) {
  const search = keyword.trim().toLowerCase();
  return orders.filter(
    (order) =>
      !search ||
      String(order.orderId ?? "")
        .toLowerCase()
        .includes(search) ||
      (order.orderNo ?? "").toLowerCase().includes(search),
  );
}

export function courtReviewsForOrder(sources: CourtSource[], orderId: string) {
  return sources.filter(
    (source) => source.reviewId != null && String(source.orderId) === orderId,
  );
}

export function courtSourcesHaveMore(
  page: Page<CourtSource>,
  pageNumber: number,
) {
  const pages = page.pages ?? page.totalPages;
  if (pages != null) {
    return pageNumber < pages;
  }
  if (page.total != null) {
    return pageNumber * PAGE_SIZE < page.total;
  }
  return pageRecords(page).length >= PAGE_SIZE;
}

// 来源接口不支持搜索和排序筛选。这里读取所有符合条件的分页，
// 使订单搜索和第二步的评价列表能包含第一页之后的数据。
export async function loadCourtSources(
  caseType: CourtCaseType,
  ownerToken: string,
  signal?: AbortSignal,
) {
  const sources = new Map<string, CourtSource>();
  function assertActive() {
    if (signal?.aborted) {
      const error = new Error("加载已取消");
      error.name = "AbortError";
      throw error;
    }
    if (!ownerToken || useAuthStore.getState().accessToken !== ownerToken) {
      throw new Error("登录状态已变化，请重新选择订单");
    }
  }
  for (let pageNumber = 1; ; pageNumber += 1) {
    assertActive();
    const page = await courtApi.getSourcePage(
      caseType,
      pageNumber,
      PAGE_SIZE,
      signal,
    );
    assertActive();
    const previousSize = sources.size;
    for (const source of pageRecords(page)) {
      sources.set(courtSourceKey(source), source);
    }
    if (!courtSourcesHaveMore(page, pageNumber)) {
      return Array.from(sources.values());
    }
    if (sources.size === previousSize) {
      throw new Error("订单列表加载异常，请重试");
    }
  }
}

export async function confirmCourtSource(
  caseType: CourtCaseType,
  source: CourtSource,
  ownerToken: string,
) {
  function assertSession() {
    if (!ownerToken || useAuthStore.getState().accessToken !== ownerToken) {
      throw new Error("登录状态已变化，请重新选择订单");
    }
  }
  assertSession();
  if (
    source.orderId == null ||
    (caseType === "DELETE_REVIEW" && source.reviewId == null)
  ) {
    throw new Error("请选择完整的订单或评价");
  }
  const preview = await courtApi.previewSource({
    caseType,
    orderId: caseType === "DELETE_REVIEW" ? undefined : source.orderId,
    reviewId: caseType === "DELETE_REVIEW" ? source.reviewId : undefined,
  });
  assertSession();
  if (
    (preview.orderId != null &&
      String(preview.orderId) !== String(source.orderId)) ||
    (caseType === "DELETE_REVIEW" &&
      preview.reviewId != null &&
      String(preview.reviewId) !== String(source.reviewId))
  ) {
    throw new Error("订单或评价信息已变化，请重新选择");
  }
  return {
    ...source,
    ...preview,
    orderId: preview.orderId ?? source.orderId,
    reviewId:
      caseType === "DELETE_REVIEW"
        ? (preview.reviewId ?? source.reviewId)
        : undefined,
  };
}
