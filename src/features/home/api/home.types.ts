export type HomeTab = "home" | "court";
export type GameKey = string;

export type Game = {
  id: number;
  name: string;
  iconUrl?: string;
  backgroundUrl?: string;
  category?: number;
};

export type Banner = {
  id: string;
  imageUrl?: string;
  title?: string;
  subtitle?: string;
};

export type Club = {
  id: string;
  name: string;
  description: string;
  coverUrl?: string;
  onlineCount: number;
  memberCount: number;
  clubCode: string;
  isSelfOperated?: boolean;
};

export type ClubPage = {
  items: Club[];
  hasMore: boolean;
  nextPage: number;
};

export type ClubDetailGame = Game & {
  clubGameId: number;
  clubId: number;
  status: number;
};

export type ClubDetail = {
  id: string;
  name: string;
  logoUrl?: string;
  intro: string;
  memberCount: number;
  followCount: number;
  pageConfigGroupId?: string;
  games: ClubDetailGame[];
};

export type ClubGameMode = {
  id: number;
  gameId: number;
  modeName: string;
};

export type Companion = {
  profileId: number;
  nickname: string;
  headImage?: string;
  sex?: number;
  signature?: string;
  voiceDurationSeconds?: number;
  orderCount: number;
  onlineStatus: number;
  gameStatus: number;
  price: number;
};

export type CompanionFilters = {
  clubId: string;
  gameId: string;
  priceSort?: "DEFAULT" | "ASC" | "DESC";
  onlineOnly?: boolean;
  sex?: 1 | 2;
  gameStatus?: 0 | 1;
  gameModeId?: number;
  gameLevelId?: number;
};

export type CompanionPage = {
  items: Companion[];
  hasMore: boolean;
  nextPage: number;
};
