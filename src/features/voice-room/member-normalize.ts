import type { VoiceRoomDetail, VoiceRoomMember } from "./voice-room.types";

export const inviteMember: VoiceRoomMember = {
  userId: "invite",
  nickname: "邀请用户",
  role: "guest",
};

export function normalizeMembers(
  detail: VoiceRoomDetail | undefined,
  currentUser?: { id: string; nickname?: string; headImage?: string },
) {
  const currentUserId = currentUser ? String(currentUser.id) : undefined;
  const creatorUserId =
    detail?.creatorUserId == null ? "" : String(detail.creatorUserId);
  const serviceUserId =
    detail?.serviceUserId == null ? "" : String(detail.serviceUserId);
  const self: VoiceRoomMember[] = currentUser
    ? [
        {
          userId: currentUserId!,
          nickname: currentUser.nickname || "我",
          avatar: currentUser.headImage,
          role:
            creatorUserId === currentUserId ? ("owner" as const) : undefined,
        },
      ]
    : [];
  const people = (detail?.members || [])
    .filter(
      (member) =>
        String(member.userId) !== currentUserId && member.userId !== "invite",
    )
    .map((member) => {
      const userId = String(member.userId);
      const role =
        userId === creatorUserId
          ? ("owner" as const)
          : userId === serviceUserId
            ? ("service" as const)
            : member.role;
      return { ...member, userId, role };
    });
  // 房主固定排在第一个麦位，其余成员按加入顺序排列
  const isSelfOwner = Boolean(creatorUserId) && creatorUserId === currentUserId;
  const owner = people.filter((member) => member.role === "owner");
  const others = people.filter((member) => member.role !== "owner");
  const normalizedMembers: VoiceRoomMember[] = [
    ...owner,
    ...(isSelfOwner ? self : self.filter((member) => member.role !== "owner")),
    ...others,
  ];
  return [...normalizedMembers.slice(0, 7), inviteMember];
}

/**
 * 用后端权威名单校正增量维护的成员列表（融云成员事件不存离线，漏一次就永久残留）。
 * 以 normalizeMembers 结果为准，仅保留本地已有的麦克风/说话状态，避免闭麦角标闪烁。
 */
export function reconcileMembers(
  current: VoiceRoomMember[],
  detail: VoiceRoomDetail | undefined,
  currentUser?: { id: string; nickname?: string; headImage?: string },
): VoiceRoomMember[] {
  const localStateByUserId = new Map(
    current.map((member) => [member.userId, member]),
  );
  return normalizeMembers(detail, currentUser).map((member) => {
    const local = localStateByUserId.get(member.userId);
    if (!local) {
      return member;
    }
    return {
      ...member,
      ...(local.micOpen != null ? { micOpen: local.micOpen } : {}),
      ...(local.speaking != null ? { speaking: local.speaking } : {}),
    };
  });
}
