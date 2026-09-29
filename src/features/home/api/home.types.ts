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
