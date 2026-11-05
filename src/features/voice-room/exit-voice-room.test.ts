import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// 该 import 解析到下方 vi.mock 的 stub，不会拉入 react-native 依赖链
import { ApiError } from '@/core/network/api-client';

import { exitVoiceRoom, isRoomGoneExitError } from './exit-voice-room';
import { useVoiceRoomSessionStore, type ActiveVoiceRoom } from './voice-room-session';
import { isVoiceRoomIntentionalExit } from './voice-room-session';
import { leaveVoiceRtc } from './voice-room-rtc';
import { leaveVoiceChatRoom } from './voice-room-rongcloud';
import { voiceRoomApi } from './voice-room.api';

vi.mock('@/core/network/api-client', () => {
  class ApiError extends Error {
    constructor(message: string, public readonly status: number) {
      super(message);
      this.name = 'ApiError';
    }
  }
  return { ApiError };
});
vi.mock('./voice-room-rtc', () => ({ leaveVoiceRtc: vi.fn(async () => undefined) }));
vi.mock('./voice-room-rongcloud', () => ({ leaveVoiceChatRoom: vi.fn(async () => undefined) }));
vi.mock('./voice-room.api', () => ({ voiceRoomApi: { leave: vi.fn(), destroy: vi.fn() } }));

const room: ActiveVoiceRoom = {
  roomId: '12', roomVersion: '3', rongChatroomId: 'voice_12_3',
  roomName: '语聊房', creatorUserId: '10', ownerName: '房主',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  useVoiceRoomSessionStore.setState({ activeRoom: room, joiningRoom: null, lastKickedRoom: null, microphoneMuted: false });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('isRoomGoneExitError', () => {
  it.each(['房间不存在', '房间已发生变更，请刷新后重试'])('matches backend room-gone info: %s', (info) => {
    expect(isRoomGoneExitError(new Error(info))).toBe(true);
  });

  it('does not match other errors', () => {
    expect(isRoomGoneExitError(new Error('网络连接失败，请检查网络后重试'))).toBe(false);
    expect(isRoomGoneExitError(undefined)).toBe(false);
  });
});

describe('exitVoiceRoom', () => {
  it('leaves via HTTP first, then cleans both SDKs and clears the session', async () => {
    vi.mocked(voiceRoomApi.leave).mockResolvedValueOnce(undefined);
    await exitVoiceRoom(room, '42', 'token');
    expect(voiceRoomApi.leave).toHaveBeenCalledTimes(1);
    expect(leaveVoiceRtc).toHaveBeenCalledTimes(1);
    expect(leaveVoiceChatRoom).toHaveBeenCalledWith('voice_12_3');
    expect(useVoiceRoomSessionStore.getState().activeRoom).toBeNull();
    expect(voiceRoomApi.destroy).not.toHaveBeenCalled();
  });

  it('destroys via HTTP for the owner and marks the intentional exit', async () => {
    vi.mocked(voiceRoomApi.destroy).mockResolvedValueOnce(undefined);
    await exitVoiceRoom(room, '10', 'token');
    expect(isVoiceRoomIntentionalExit(room)).toBe(true);
    expect(voiceRoomApi.destroy).toHaveBeenCalledTimes(1);
    expect(voiceRoomApi.leave).not.toHaveBeenCalled();
    expect(leaveVoiceRtc).toHaveBeenCalledTimes(1);
    expect(useVoiceRoomSessionStore.getState().activeRoom).toBeNull();
  });

  it('retries once after a transient network failure and then cleans up', async () => {
    vi.mocked(voiceRoomApi.leave)
      .mockRejectedValueOnce(new ApiError('网络连接失败，请检查网络后重试', 0))
      .mockResolvedValueOnce(undefined);
    const task = exitVoiceRoom(room, '42', 'token');
    await vi.runAllTimersAsync();
    await task;
    expect(voiceRoomApi.leave).toHaveBeenCalledTimes(2);
    expect(leaveVoiceRtc).toHaveBeenCalledTimes(1);
    expect(leaveVoiceChatRoom).toHaveBeenCalledWith('voice_12_3');
    expect(useVoiceRoomSessionStore.getState().activeRoom).toBeNull();
  });

  it('skips SDK cleanup and rethrows when the retry still fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.mocked(voiceRoomApi.leave)
      .mockRejectedValueOnce(new ApiError('网络连接失败，请检查网络后重试', 0))
      .mockRejectedValueOnce(new ApiError('网络连接失败，请检查网络后重试', 0));
    const task = exitVoiceRoom(room, '42', 'token');
    const assertion = expect(task).rejects.toThrow('网络连接失败');
    await vi.runAllTimersAsync();
    await assertion;
    expect(voiceRoomApi.leave).toHaveBeenCalledTimes(2);
    expect(leaveVoiceRtc).not.toHaveBeenCalled();
    expect(leaveVoiceChatRoom).not.toHaveBeenCalled();
    expect(useVoiceRoomSessionStore.getState().activeRoom).toBe(room);
    warn.mockRestore();
  });

  it('does not retry a business failure and keeps the room', async () => {
    vi.mocked(voiceRoomApi.leave).mockRejectedValueOnce(new Error('登录状态已失效'));
    await expect(exitVoiceRoom(room, '42', 'token')).rejects.toThrow('登录状态已失效');
    expect(voiceRoomApi.leave).toHaveBeenCalledTimes(1);
    expect(leaveVoiceRtc).not.toHaveBeenCalled();
    expect(useVoiceRoomSessionStore.getState().activeRoom).toBe(room);
  });

  it('proceeds with SDK cleanup when the owner destroy reports a rebuilt room without retrying', async () => {
    vi.mocked(voiceRoomApi.destroy).mockRejectedValueOnce(new Error('房间已发生变更，请刷新后重试'));
    await exitVoiceRoom(room, '10', 'token');
    expect(voiceRoomApi.destroy).toHaveBeenCalledTimes(1);
    expect(leaveVoiceRtc).toHaveBeenCalledTimes(1);
    expect(leaveVoiceChatRoom).toHaveBeenCalledWith('voice_12_3');
    expect(useVoiceRoomSessionStore.getState().activeRoom).toBeNull();
  });

  it('proceeds with SDK cleanup when the room no longer exists', async () => {
    vi.mocked(voiceRoomApi.leave).mockRejectedValueOnce(new Error('房间不存在'));
    await exitVoiceRoom(room, '42', 'token');
    expect(voiceRoomApi.leave).toHaveBeenCalledTimes(1);
    expect(leaveVoiceRtc).toHaveBeenCalledTimes(1);
    expect(useVoiceRoomSessionStore.getState().activeRoom).toBeNull();
  });
});
