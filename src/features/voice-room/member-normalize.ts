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
  // 房主固定排在第一个麦位，其余成员按加入顺序排列；邀请位固定最后一位
  const isSelfOwner = Boolean(creatorUserId) && creatorUserId === currentUserId;
  const owner = people.filter((member) => member.role === "owner");
  const others = people.filter((member) => member.role !== "owner");
  const normalizedMembers: VoiceRoomMember[] = [
    ...owner,
    ...(isSelfOwner ? self : self.filter((member) => member.role !== "owner")),
    ...others,
  ];
  return [...normalizedMembers, inviteMember];
}

/**
 * 按融云聊天室成员事件增量维护成员列表（actionType 1=加入 2=离开）。
 * 屏内实时监听与 join 后快照对账共用同一套语义，重放事件须幂等。
 */
export function applyChatRoomMemberActions(
  items: VoiceRoomMember[],
  actions: { userId?: string; actionType?: number }[],
  context: { selfId?: string; creatorUserId?: string | number; serviceUserId?: string | number },
): VoiceRoomMember[] {
  return actions.reduce<VoiceRoomMember[]>((next, action) => {
    const userId = action.userId == null ? "" : String(action.userId);
    if (!userId || userId === "invite" || userId === context.selfId) return next;
    if (action.actionType === 2)
      return next.filter((member) => member.userId !== userId);
    if (
      action.actionType === 1 &&
      !next.some((member) => member.userId === userId)
    ) {
      return [
        ...next.filter((member) => member.userId !== "invite"),
        {
          userId,
          nickname: `用户${userId}`,
          role:
            String(context.creatorUserId ?? "") === userId
              ? ("owner" as const)
              : String(context.serviceUserId ?? "") === userId
                ? ("service" as const)
                : ("guest" as const),
        },
        inviteMember,
      ];
    }
    return next;
  }, items);
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
