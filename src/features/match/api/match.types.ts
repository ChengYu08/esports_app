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
