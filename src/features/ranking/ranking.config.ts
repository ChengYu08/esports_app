import type {
    RankingBoard,
    RankingFilters,
    RankingItem,
    RankingPeriod,
} from "./api/ranking.types";

export const RANKING_BOARDS = [
  {
    key: "GOD",
    label: "神豪榜",
    title: "神豪榜",
    nameColumnLabel: "用户昵称",
    metricLabel: "豪气值",
    hasGame: false,
  },
  {
    key: "ORDER_RECEIVE",
    label: "接单榜",
    title: "接单榜",
    nameColumnLabel: "大神昵称",
    metricLabel: "总订单",
    hasGame: true,
  },
  {
    key: "TURNOVER",
    label: "流水榜",
    title: "流水榜",
    nameColumnLabel: "大神昵称",
    metricLabel: "竹子收益",
    hasGame: true,
  },
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

export function getRankingRulesTitle(
  board: RankingBoard,
  period: RankingPeriod,
) {
  if (board === "GOD") return "榜单说明";
  return `${getRankingBoard(board).label}（${period === "DAILY" ? "日榜" : "周榜"}）规则`;
}

/** 接口已返回展示数值（不是分），这里只负责按移动端榜单样式缩写。 */
export function formatRankingMetric(
  value: number,
  board: RankingBoard,
): string {
  if (board === "ORDER_RECEIVE") {
    return `${Math.round(value)}单`;
  }
  if (board === "TURNOVER") {
    return String(Math.round(value));
  }
  if (value < 1000) {
    return String(value);
  }
  return `${(value / 1000).toFixed(1).replace(/\.0$/, "")}k`;
}

/** 后端未返回距离上一名差值时，用相邻名次的指标差兜底计算。 */
export function withRankingGap(items: RankingItem[]): RankingItem[] {
  return items.map((item, index) => {
    if (item.distanceToPrev != null || index === 0) {
      return item;
    }
    const prev = items[index - 1];
    return {
      ...item,
      distanceToPrev: Math.max(0, prev.metricValue - item.metricValue),
    };
  });
}
