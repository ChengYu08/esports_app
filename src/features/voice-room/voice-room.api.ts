import { apiClient } from '@/core/network/api-client';
import type { VoiceRoomDetail, VoiceRoomJoinPrepare, VoiceRoomRtcToken } from './voice-room.types';

type Envelope<T> = { success?: boolean; code?: string; info?: string; data?: T };

function unwrap<T>(response: Envelope<T> | T): T {
  if (response && typeof response === 'object' && 'success' in response && response.success === false) {
    throw new Error((response as Envelope<T>).info || '语聊房请求失败');
  }
  // panzhi /client/v1 包络成功但省略 data 时表示无数据（如 joined/current 不在房间），必须返回 null
  // 而不是整个包络，否则包络会被误当成业务对象（对齐 PC apiRequest 的 body.data ?? null）。
  if (response && typeof response === 'object' && ('success' in response || 'code' in response)) {
    return ((response as Envelope<T>).data ?? null) as T;
  }
  return response as T;
}

async function post<T>(path: string, token: string, body?: unknown) {
  const response = await apiClient<Envelope<T> | T>(path, { method: 'POST', token, body });
  return unwrap(response);
}

export function resolveVoiceRoomId(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const room = value as Record<string, unknown>;
  for (const key of ['id', 'roomId', 'voiceRoomId']) {
    const candidate = room[key];
    if ((typeof candidate === 'string' && candidate.trim()) || (typeof candidate === 'number' && Number.isFinite(candidate))) {
      return String(candidate);
    }
  }
  for (const key of ['data', 'result', 'roomInfo', 'room']) {
    const nestedId = resolveVoiceRoomId(room[key]);
    if (nestedId) return nestedId;
  }
  return null;
}

export const voiceRoomApi = {
  getJoinedRoom(token: string) {
    return post<VoiceRoomDetail | null>('/client/v1/voiceRoom/joined/current', token, {});
  },
  createRoom(roomName: string, token: string, clubId?: string | number) {
    return post<VoiceRoomDetail>('/client/v1/voiceRoom/create', token, {
      action: { roomName, ...(clubId ? { clubId } : {}) },
    });
  },
  getDetail(roomId: string, token: string) {
    return post<VoiceRoomDetail>(`/client/v1/voiceRoom/${encodeURIComponent(roomId)}/detail`, token);
  },
  prepareJoin(roomId: string, roomVersion: string | number, token: string) {
    return post<VoiceRoomJoinPrepare>(
      `/client/v1/voiceRoom/${encodeURIComponent(roomId)}/join/prepare?roomVersion=${encodeURIComponent(String(roomVersion))}`,
      token,
    );
  },
  getRtcToken(roomId: string, roomVersion: string | number, token: string) {
    return post<VoiceRoomRtcToken>(
      `/client/v1/voiceRoom/${encodeURIComponent(roomId)}/rtc/token?roomVersion=${encodeURIComponent(String(roomVersion))}`,
      token,
    );
  },
  leave(roomId: string, roomVersion: string | number, token: string) {
    return post<unknown>(
      `/client/v1/voiceRoom/${encodeURIComponent(roomId)}/leave?roomVersion=${encodeURIComponent(String(roomVersion))}`,
      token,
    );
  },
  destroy(roomId: string, roomVersion: string | number, token: string) {
    return post<unknown>(
      `/client/v1/voiceRoom/${encodeURIComponent(roomId)}/destroy?roomVersion=${encodeURIComponent(String(roomVersion))}`,
      token,
    );
  },
  async kickMember(roomId: string, roomVersion: string | number, userId: string, token: string) {
    const response = await apiClient<Envelope<null>>(
      `/client/v1/voiceRoom/${encodeURIComponent(roomId)}/kickOut`,
      { method: 'POST', token, body: { action: { roomVersion, userId } } },
    );
    if (response.success === false || response.code !== 'SUCCESS') {
      throw new Error(response.info || '踢出失败，请稍后重试');
    }
  },
  inviteClubService(roomId: string, roomVersion: string | number, clubId: string | number, token: string) {
    return post<unknown>('/client/v1/voiceRoom/inviteClubService', token, {
      action: { roomId, roomVersion, clubId },
    });
  },
  /** 俱乐部接待抢单（对齐 PC claimClubService） */
  claimClubService(
    data: { roomId: string; clubId: string; roomVersion: string },
    token: string,
  ) {
    return post<{ roomInfo?: VoiceRoomDetail } & VoiceRoomDetail>(
      '/client/v1/voiceRoom/claimClubService',
      token,
      { action: data },
    );
  },
};

