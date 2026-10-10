export function createProfileChatParams(profile: { userId: string | number; nickname?: string; headImage?: string; clubId?: string | number }) {
  return {
    id: String(profile.userId),
    title: profile.nickname || "用户聊天",
    avatar: profile.headImage || "",
    ...(profile.clubId !== undefined && Number(profile.clubId) > 0 ? { clubId: String(profile.clubId) } : {}),
  };
}
