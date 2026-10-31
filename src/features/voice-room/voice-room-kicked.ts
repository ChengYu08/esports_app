import type { RongCommand } from '@/features/message/rongcloud-command';
import { leaveVoiceRtc } from './voice-room-rtc';
import { leaveVoiceChatRoom } from './voice-room-rongcloud';
import { isVoiceRoomIntentionalExit, useVoiceRoomSessionStore, type ActiveVoiceRoom } from './voice-room-session';

async function dismissKickedRoom(room: ActiveVoiceRoom, notify: () => void) {
  // The server already removed membership or destroyed the chatroom. Do not
  // call leave/destroy again. Start both SDK cleanups before navigation;
  // consume the session immediately so a second event or a late join cannot
  // restore it or show another alert.
  const cleanup = Promise.allSettled([leaveVoiceRtc(), leaveVoiceChatRoom(room.rongChatroomId)]);
  useVoiceRoomSessionStore.setState({ activeRoom: null, joiningRoom: null, lastKickedRoom: room, microphoneMuted: true });
  notify();
  const results = await cleanup;
  results.forEach((result) => {
    if (result.status === 'rejected') console.warn('[voice-room] kicked cleanup failed', result.reason);
  });
}

export async function handleVoiceRoomKicked(
  command: RongCommand, userId: string, notify: () => void, now = Date.now(),
) {
  if (!userId || command.name !== 'ROOM_KICKED' || command.senderId !== '50000000'
    || String(command.data.targetUserId ?? '') !== userId) return;
  const banUntil = Number(command.data.banUntil);
  if (!Number.isFinite(banUntil) || banUntil <= now) return;
  const { activeRoom, joiningRoom } = useVoiceRoomSessionStore.getState();
  const room = joiningRoom || activeRoom;
  if (!room || room.roomId !== String(command.data.roomId)
    || room.roomVersion !== String(command.data.roomVersion)) return;
  await dismissKickedRoom(room, notify);
}

export async function handleVoiceRoomBlocked(
  event: { chatroomId?: string; userIdList?: string[] }, userId: string, notify: () => void,
) {
  if (!userId || !event.userIdList?.includes(userId)) return;
  const { activeRoom, joiningRoom } = useVoiceRoomSessionStore.getState();
  const room = joiningRoom || activeRoom;
  if (!room || room.rongChatroomId !== event.chatroomId) return;
  await dismissKickedRoom(room, notify);
}

export async function handleVoiceRoomDestroyed(chatroomId: string, notify: () => void) {
  if (!chatroomId) {
    return;
  }
  const { activeRoom, joiningRoom } = useVoiceRoomSessionStore.getState();
  const room = joiningRoom || activeRoom;
  if (!room || room.rongChatroomId !== chatroomId) {
    return;
  }
  if (isVoiceRoomIntentionalExit(room)) {
    return;
  }
  await dismissKickedRoom(room, notify);
}
