import type { VoiceRoomDetail } from './voice-room.types';

export function canKickVoiceRoomMember(
  room: VoiceRoomDetail | null,
  viewerId: string | undefined,
  targetId: string | undefined,
): boolean {
  if (!room || !viewerId || !targetId || targetId === 'invite' || viewerId === targetId) return false;
  const ownerId = String(room.creatorUserId ?? '');
  const serviceId = String(room.serviceUserId ?? '');
  return (viewerId === ownerId || viewerId === serviceId)
    && targetId !== ownerId && targetId !== serviceId;
}

export function getMemberAge(birth?: string, now = new Date()): string {
  if (!birth) return '';
  const date = new Date(birth);
  if (Number.isNaN(date.getTime()) || date > now) return '';
  let age = now.getFullYear() - date.getFullYear();
  if (now.getMonth() < date.getMonth()
    || (now.getMonth() === date.getMonth() && now.getDate() < date.getDate())) age -= 1;
  return age >= 0 ? String(age) : '';
}
