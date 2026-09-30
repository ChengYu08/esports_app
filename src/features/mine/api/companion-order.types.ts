export type CompanionOrderContext = {
  serviceUserId: number;
  clubId: number;
  gameId: number;
  gameLevelId: number;
  gameModeName: string;
  gameLevelName: string;
  buyerUserId: number;
};

export type CompanionServiceOption = {
  companionServiceId: number;
  name: string;
  price: number;
};
