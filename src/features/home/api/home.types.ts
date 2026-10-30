export type HomeTab = "home" | "god" | "ranking" | "court";
export type GameKey = string;

export type Game = {
  id: number;
  name: string;
  iconUrl?: string;
  backgroundUrl?: string;
  category?: number;
  gameCategoryId?: string;
};

export type GameCategory = {
  id: string;
  name: string;
  iconUrl?: string;
};

export type ClubFilters = {
  gameId?: string;
  gameCategoryId?: string;
};

export type Banner = {
  id: string;
  imageUrl: string;
  title?: string;
  contentImageUrl?: string;
  linkUrl?: string;
};

export type HomeBannerSlotCode = "APP_HOME_FLOOR1" | "APP_HOME_FLOOR2" | "APP_HOME_FLOOR3";

export type HomeBannerSlot = {
  code: HomeBannerSlotCode;
  name: string;
  displayMode: "CAROUSEL" | "TILE";
  intervalMs: number;
  items: Banner[];
};

export type ClubGameIcon = {
  id: number;
  name: string;
  iconUrl?: string;
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
  clubTag?: string;
  clubGames?: { iconUrl?: string }[];
  games?: ClubGameIcon[];
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
  userId: number;
  nickname: string;
  headImage?: string;
  sex?: number;
  age: number | null;
  signature: string;
  voiceDurationSeconds?: number;
  voiceUrl?: string;
  orderCount: number;
  onlineStatus: number;
  gameStatus: number;
  price: number;
  gameName: string;
  /** 卡内陪玩标签名（明星/魔王pro 等），空表示不展示标签 */
  tagName: string;
  /** 标签通用背景色（对齐 PC 端 tagBackgroundColor），后台未配置时为空串由 UI 兜底 */
  tagBackgroundColor: string;
  /** 卡片第三行斜杠文本三要素：游戏模式 / 游戏等级 / 服务 */
  modeName: string;
  levelName: string;
  serviceName: string;
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

export type PriceListTab = {
  menuTitle: string;
  imageUrl: string;
  sortNo: number;
};
