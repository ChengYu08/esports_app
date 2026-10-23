export type MatchGame = {
  id: string;
  name: string;
  iconUrl?: string;
};

export type MatchClub = {
  id: string;
  name: string;
  logoUrl?: string;
  memberCount?: number;
};

export type MatchMode = {
  id: string;
  name: string;
};

export type MatchLevel = {
  id: string;
  name: string;
};

export type MatchService = {
  id: string;
  name: string;
  malePrice: number;
  femalePrice: number;
  billingUnitName?: string;
  supportMultiCompanion: boolean;
};

/** 0不限 / 1男 / 2女 */
export type MatchGenderRequirement = 0 | 1 | 2;

/** 1单陪 / 2双陪 */
export type MatchCompanionPreference = 1 | 2;

export type MatchVoiceOption = "不试音" | "需试音";

export type PublishQuickMatchPayload = {
  clubId: number;
  publishType: "BUYER";
  gameId: number;
  gameModeId: number;
  gameLevelId: number;
  gameServiceId: number;
  genderRequirement: number;
  quantity: number;
  needVoice: boolean;
  companionPreference?: 1 | 2;
  remark?: string;
};

export type QuickMatchPublishResult = {
  requestNo: string;
  roomId?: number | string | null;
  roomVersion?: number | string | null;
  expireTime?: string;
};

export type QuickMatchGrabStatus = "GRABBED" | "SUCCESS" | "FAILED";

export type QuickMatchGrabItem = {
  id: string;
  requestNo?: string;
  companionUserId?: string;
  companionServiceId?: string;
  nickname: string;
  headImage?: string;
  /** 0未知 1男 2女 */
  sex: 0 | 1 | 2;
  grabStatus?: QuickMatchGrabStatus;
  remark?: string;
  clubId?: string;
};

export type QuickMatchRequestDetail = {
  requestNo: string;
  clubId?: string;
  gameId?: string;
  gameModeId?: string;
  gameLevelId?: string;
  gameServiceId?: string;
  gameName?: string;
  modeName?: string;
  levelName?: string;
  serviceName?: string;
  billingUnitName?: string;
  genderRequirement?: number;
  quantity?: number;
  needVoice?: boolean;
  companionPreference?: 1 | 2 | null;
  roomId?: string | null;
  roomVersion?: string | null;
  remark?: string;
  /** MATCHING / ORDERED / CANCELLED / EXPIRED */
  status?: string;
  expireTime?: string;
};

export type QuickMatchPayable = {
  orderCount: number;
  totalPrice: number;
};

export type QuickMatchAuditionRoom = {
  id: string;
  roomVersion?: string | number;
  roomName?: string;
  creatorUserId?: string | number;
};

export function isQuickMatchActive(request: QuickMatchRequestDetail | null): boolean {
  if (!request || request.status !== "MATCHING") return false;
  if (!request.expireTime) return true;
  return new Date(request.expireTime).getTime() > Date.now();
}
