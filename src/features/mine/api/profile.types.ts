export type ProfileRouteParams = {
  clubId?: string;
  userId: string;
};

export type ProfileGameRouteParams = {
  clubId: string;
  userId: string;
  gameId: string;
};

export type ProfileGame = {
  companionGameId: number;
  gameId: number;
  gameName: string;
  iconUrl?: string;
  backgroundUrl?: string;
};

export type ProfileDetail = {
  userId: number;
  nickname: string;
  signature: string;
  headImage?: string;
  sex?: number;
  birth?: string;
  followCount: number;
  fansCount: number;
  profileId?: number;
  clubId: number;
  clubName: string;
  logoUrl?: string;
  orderCount: number;
  onlineStatus: number;
  gameStatus: number;
  games: ProfileGame[];
};

export type ProfileGameImage = {
  id: number;
  imageUrl: string;
  sortNo: number;
};

export type ProfileSkillCard = {
  companionServiceId: number;
  gameId: string;
  gameModeId: number;
  modeName: string;
  gameLevelId: number;
  levelName: string;
  clubGameServiceId: number;
  price: number;
  orderCount: number;
  goodRate?: number | null;
};

export type ProfileGameDetail = {
  companionGameId: number;
  userId: number;
  clubId: number;
  gameId: number;
  gameName: string;
  iconUrl?: string;
  backgroundUrl?: string;
  skillIntro: string;
  voiceUrl?: string;
  voiceDurationSeconds: number;
  images: ProfileGameImage[];
  skillCards: ProfileSkillCard[];
};

export type ProfileReview = {
  id: number;
  orderNo?: string;
  buyerNickname: string;
  buyerAvatar?: string;
  anonymous: boolean;
  rating: number;
  content: string;
  imageUrls: string[];
  evaluatedTime?: string;
};

export type ProfileReviewPage = {
  page: number;
  totalPages: number;
  total: number;
  items: ProfileReview[];
  hasMore: boolean;
};
