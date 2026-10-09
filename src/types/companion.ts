/**
 * 陪玩资料类型定义
 */

export interface CompanionGame {
  gameId: string;
  gameName: string;
  gameIcon?: string;
}

export interface CompanionService {
  serviceId: string;
  serviceName: string;
  price: number;
  unit?: string;
}

export interface CompanionProfile {
  clubId?: string;
  clubName?: string;
  gameList?: CompanionGame[];
  services?: CompanionService[];
}

export interface UserDetailResponse {
  userId: string;
  nickname: string;
  headImage?: string;
  followCount?: number;
  fansCount?: number;
  signature?: string;
  companionProfile?: CompanionProfile;
}
