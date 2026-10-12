export type RankingBoard = "GOD" | "ORDER_RECEIVE" | "TURNOVER";
export type RankingPeriod = "DAILY" | "WEEKLY";

export type RankingFilters = {
  boardCode: RankingBoard;
  rankType: RankingPeriod;
  gameId: string;
};

export type RankingItem = {
  rankNo: number;
  userId: string;
  nickname: string;
  avatar?: string;
  clubId: string | null;
  clubName: string | null;
  metricValue: number;
  distanceToPrev: number | null;
};

export type MyRanking = {
  visible: boolean;
  rankNo: number | null;
  metricValue: number;
};
