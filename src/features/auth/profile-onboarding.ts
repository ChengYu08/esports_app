type ProfileDecisionSource = {
  nickname?: string;
  gender?: number;
  isRealName?: number;
};

// 后端注册默认昵称前缀（pzdj-service ClientUserServiceImpl#buildDefaultNickname：盼友_ + 12位随机数字）
const DEFAULT_NICKNAME_PREFIX = "盼友_";

/**
 * 按服务端资料推断是否需要弹出完善资料页。
 * 新注册用户：默认昵称 + 性别未知(0) + 未实名；任一资料被用户主动完善过就不再弹。
 */
export function isProfileIncomplete(profile: ProfileDecisionSource): boolean {
  const nickname = profile.nickname ?? "";
  const genderSet = profile.gender === 1 || profile.gender === 2;
  const realNamed = profile.isRealName === 1;
  const nicknameUntouched = nickname === "" || nickname.startsWith(DEFAULT_NICKNAME_PREFIX);
  if (!nicknameUntouched) return false;
  if (genderSet) return false;
  if (realNamed) return false;
  return true;
}
