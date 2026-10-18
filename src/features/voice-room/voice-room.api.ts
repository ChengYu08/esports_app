import { apiClient } from '@/core/network/api-client';
import type { VoiceRoomDetail, VoiceRoomJoinPrepare, VoiceRoomRtcToken } from './voice-room.types';

type Envelope<T> = { success?: boolean; code?: string; info?: string; data?: T };

function unwrap<T>(response: Envelope<T> | T): T {
  if (response && typeof response === 'object' && 'data' in response && response.data !== undefined) {
    const envelope = response as Envelope<T>;
    if (envelope.success === false) throw new Error(envelope.info || '语聊房请求失败');
    return envelope.data as T;
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
  inviteClubService(roomId: string, roomVersion: string | number, clubId: string | number, token: string) {
    return post<unknown>('/client/v1/voiceRoom/inviteClubService', token, {
      action: { roomId, roomVersion, clubId },
    });
  },
};

