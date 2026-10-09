export function createProfileChatParams(profile: { userId: string | number; nickname?: string; headImage?: string }) {
  return {
    id: String(profile.userId),
    title: profile.nickname || "用户聊天",
    avatar: profile.headImage || "",
  };
}
