import type { RankingBoard, RankingFilters, RankingPeriod } from "./api/ranking.types";

export const RANKING_BOARDS = [
  { key: "GOD", label: "神豪榜", metricLabel: "神豪值", hasGame: false },
  { key: "ORDER_RECEIVE", label: "接单榜", metricLabel: "接单数", hasGame: true },
  { key: "TURNOVER", label: "流水榜", metricLabel: "流水值", hasGame: true },
] as const;

export const RANKING_PERIODS = [
  { key: "DAILY", label: "日榜" },
  { key: "WEEKLY", label: "周榜" },
] as const;

export const DEFAULT_RANKING_FILTERS: RankingFilters = {
  boardCode: "ORDER_RECEIVE",
  rankType: "DAILY",
  gameId: "0",
};

export function getRankingBoard(board: RankingBoard) {
  return RANKING_BOARDS.find((item) => item.key === board)!;
}

export function getRankingRulesTitle(board: RankingBoard, period: RankingPeriod) {
  if (board === "GOD") return "榜单说明";
  return `${getRankingBoard(board).label}（${period === "DAILY" ? "日榜" : "周榜"}）规则`;
}

/** Match the PC display units; the API already returns display values, not cents. */
export function formatRankingMetric(value: number, board: RankingBoard): string {
  if (board === "ORDER_RECEIVE") return `${Math.round(value).toLocaleString("en-US")} 单`;
  const divisor = board === "GOD" ? 1000 : 10000;
  if (value < divisor) return String(value);
  return `${(value / divisor).toFixed(1).replace(/\.0$/, "")}${board === "GOD" ? "K" : "万"}`;
}
