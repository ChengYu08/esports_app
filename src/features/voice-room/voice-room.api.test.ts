import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/core/network/api-client';
import { voiceRoomApi } from './voice-room.api';

vi.mock('@/core/network/api-client', () => ({ apiClient: vi.fn() }));

const request = vi.mocked(apiClient);

describe('kick voice room member', () => {
  beforeEach(() => request.mockReset());

  it('sends the target and room instance version in the backend action envelope', async () => {
    request.mockResolvedValue({ code: 'SUCCESS', data: null });
    await voiceRoomApi.kickMember('10', 3, '30', 'test-token');
    expect(request).toHaveBeenCalledWith('/client/v1/voiceRoom/10/kickOut', {
      method: 'POST', token: 'test-token', body: { action: { roomVersion: 3, userId: '30' } },
    });
  });

  it('rejects a business failure even when the HTTP request succeeds', async () => {
    request.mockResolvedValue({ code: 'FAIL', info: '只有房主或当前接待可以踢人', data: null });
    await expect(voiceRoomApi.kickMember('10', 3, '30', 'test-token')).rejects.toThrow('只有房主或当前接待可以踢人');
  });

  it('keeps network and partial kick failures visible so the user can retry', async () => {
    request.mockRejectedValue(new Error('网络连接失败'));
    await expect(voiceRoomApi.kickMember('10', 3, '30', 'test-token')).rejects.toThrow('网络连接失败');
    request.mockResolvedValue({ code: 'SUCCESS', success: false, info: '踢人操作未完成，请稍后重试' });
    await expect(voiceRoomApi.kickMember('10', 3, '30', 'test-token')).rejects.toThrow('踢人操作未完成');
  });
});
