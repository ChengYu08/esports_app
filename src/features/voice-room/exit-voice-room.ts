import { voiceRoomApi } from './voice-room.api';
import { leaveVoiceRtc } from './voice-room-rtc';
import { leaveVoiceChatRoom } from './voice-room-rongcloud';
import { markVoiceRoomIntentionalExit, useVoiceRoomSessionStore } from './voice-room-session';

type RoomToExit = {
  roomId: string;
  roomVersion: string | number;
  creatorUserId?: string | number;
  rongChatroomId?: string;
};

export async function exitVoiceRoom(room: RoomToExit, userId: string, accessToken: string) {
  if (String(room.creatorUserId ?? '') === userId) {
    // 先打标再请求：destroy 引发的融云销毁事件可能先于 HTTP 响应到达
    markVoiceRoomIntentionalExit(room);
    await voiceRoomApi.destroy(room.roomId, room.roomVersion, accessToken);
  } else {
    await voiceRoomApi.leave(room.roomId, room.roomVersion, accessToken);
  }

  // Once the server has accepted the exit, attempt both SDK cleanups even if one fails.
  const results = await Promise.allSettled([
    leaveVoiceRtc(),
    room.rongChatroomId ? leaveVoiceChatRoom(room.rongChatroomId) : Promise.resolve(),
  ]);
  results.forEach((result) => {
    if (result.status === 'rejected') console.warn('[voice-room] exit cleanup failed', result.reason);
  });
  useVoiceRoomSessionStore.getState().clearActiveRoom(room.roomId);
}
