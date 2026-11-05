import type { VoiceRoomMember, VoiceRoomMessage } from "./voice-room.types";

export type MemberChangeAction = "join" | "leave";

const roomMemberNoticeStates = new Map<string, MemberChangeAction>();

export function memberChangeNoticeKey(
  roomId: string,
  roomVersion: string | number,
  userId: string,
) {
  return `${roomId}:${roomVersion}:${userId}`;
}

/** 同 key 同 action 去重；通过则写入状态。返回 true 表示应跳过本次提示。 */
export function shouldSkipMemberChangeNotice(
  key: string,
  action: MemberChangeAction,
) {
  if (roomMemberNoticeStates.get(key) === action) return true;
  roomMemberNoticeStates.set(key, action);
  return false;
}

export function resolveMemberChangeNickname(options: {
  userId: string;
  members: VoiceRoomMember[];
  currentUser?: { id?: string; nickname?: string } | null;
}) {
  const { userId, members, currentUser } = options;
  const member = members.find((item) => item.userId === userId);
  let nickname =
    member?.nickname ||
    (currentUser?.id && String(currentUser.id) === userId
      ? currentUser.nickname || ""
      : "");
  const placeholder = `用户${userId}`;
  const isPlaceholder = !nickname || nickname === placeholder;
  if (!nickname) nickname = placeholder;
  return { nickname, isPlaceholder };
}

export function buildMemberChangeMessage(options: {
  roomId: string;
  roomVersion: string | number;
  userId: string;
  nickname: string;
  action: MemberChangeAction;
  createdAt?: number;
}): VoiceRoomMessage {
  const createdAt = options.createdAt ?? Date.now();
  const key = memberChangeNoticeKey(
    options.roomId,
    options.roomVersion,
    options.userId,
  );
  return {
    id: `member-change:${key}:${options.action}:${createdAt}`,
    userId: options.userId,
    nickname: options.nickname,
    kind: "system",
    text: options.action === "join" ? "进入了房间" : "离开了房间",
    sentAt: createdAt,
  };
}
