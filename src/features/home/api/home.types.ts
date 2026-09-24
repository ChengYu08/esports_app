export type HomeTab = "home" | "court";
export type GameKey = "pc" | "mobile";

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
