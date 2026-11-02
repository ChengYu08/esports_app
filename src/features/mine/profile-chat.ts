// fromProfile 标记本次会话从用户主页发起：主页必然已在栈中，
// 聊天页返回主页时用 dismissTo 弹回而非再 push，避免无限套娃
export function createProfileChatParams(profile: { userId: string | number; nickname?: string; headImage?: string; clubId?: string | number }) {
  return {
    id: String(profile.userId),
    title: profile.nickname || "用户聊天",
    avatar: profile.headImage || "",
    fromProfile: "1",
    ...(profile.clubId !== undefined && Number(profile.clubId) > 0 ? { clubId: String(profile.clubId) } : {}),
  };
}
