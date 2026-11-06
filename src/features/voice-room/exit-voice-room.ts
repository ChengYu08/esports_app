import { ApiError } from '@/core/network/api-client';

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

/** 后端已不认为用户在该实例内（房间销毁/重建），继续清理融云/声网不会造成名单差异 */
const ROOM_GONE_MARKERS = ['房间不存在', '房间已发生变更'];
/** 瞬时网络失败自动重试一次，避免事件链路直接丢失 */
const LEAVE_RETRY_DELAY_MS = 800;

export function isRoomGoneExitError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : '';
  return ROOM_GONE_MARKERS.some((marker) => message.includes(marker));
}

function isTransientExitError(error: unknown): boolean {
  if (!(error instanceof ApiError)) {
    return false;
  }
  return error.status === 0 || error.status >= 500;
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function requestExit(room: RoomToExit, isOwner: boolean, accessToken: string) {
  const requestExitHttp = () =>
    isOwner
      ? voiceRoomApi.destroy(room.roomId, room.roomVersion, accessToken)
      : voiceRoomApi.leave(room.roomId, room.roomVersion, accessToken);
  try {
    await requestExitHttp();
    return;
  } catch (error) {
    if (isRoomGoneExitError(error)) {
      return;
    }
    if (!isTransientExitError(error)) {
      throw error;
    }
  }
  await delay(LEAVE_RETRY_DELAY_MS);
  try {
    await requestExitHttp();
  } catch (error) {
    if (!isRoomGoneExitError(error)) {
      throw error;
    }
  }
}

export async function exitVoiceRoom(room: RoomToExit, userId: string, accessToken: string) {
  if (String(room.creatorUserId ?? '') === userId) {
    // 先打标再请求：destroy 引发的融云销毁事件可能先于 HTTP 响应到达
    markVoiceRoomIntentionalExit(room);
    await requestExit(room, true, accessToken);
  } else {
    await requestExit(room, false, accessToken);
  }

  // HTTP 已确认离房（或房间实例已不存在）后，尽力清理两个 SDK，单个失败不阻塞另一个。
  const results = await Promise.allSettled([
    leaveVoiceRtc(),
    room.rongChatroomId ? leaveVoiceChatRoom(room.rongChatroomId) : Promise.resolve(),
  ]);
  results.forEach((result) => {
    if (result.status === 'rejected') console.warn('[voice-room] exit cleanup failed', result.reason);
  });
  useVoiceRoomSessionStore.getState().clearActiveRoom(room.roomId);
}
