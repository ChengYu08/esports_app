import { describe, expect, it, vi } from 'vitest';

import { downloadRongImageMessage } from './rongcloud-im';
import type { ManagedMessage } from './message-state';

vi.mock('@/core/logging/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn() } }));
vi.mock('@/core/network/api-client', () => ({ ApiError: class ApiError extends Error {} }));
vi.mock('@/core/config/env', () => ({ getRuntimeConfig: () => ({ env: { rongCloudAppKey: 'test-key' } }) }));
// 隔离 image-compat → expo-file-system/react-native 的原生依赖链
vi.mock('@/shared/media-picker/image-compat', () => ({ isGifImage: vi.fn(() => false) }));

function receivedImage(overrides: Partial<ManagedMessage> = {}): ManagedMessage {
  return {
    id: 'uid-1',
    kind: 'image',
    imageUrl: 'https://cdn.example.com/chat/img-1.jpg',
    time: '10:00',
    isMine: false,
    status: 'sent',
    sentAt: 1,
    ...overrides,
  } as ManagedMessage;
}

describe('downloadRongImageMessage', () => {
  it('公网图片地址直接返回，不经融云 SDK 下载（iOS 远端历史消息无本地 messageId，SDK 下载必报 34204）', async () => {
    const message = receivedImage({ mediaSource: { local: '/sender/device/path.jpg' } as never });
    await expect(downloadRongImageMessage(message)).resolves.toBe('https://cdn.example.com/chat/img-1.jpg');
  });

  it('忽略接收消息里对方的本地路径，优先返回公网地址', async () => {
    const message = receivedImage({ mediaSource: { local: '/sender/device/path.jpg' } as never });
    const uri = await downloadRongImageMessage(message);
    expect(uri).not.toContain('/sender/device/path.jpg');
  });

  it('自己发出的消息优先用本地文件', async () => {
    const message = receivedImage({
      isMine: true,
      imageUrl: 'file:///var/mobile/.../img.jpg',
      mediaSource: { local: '/var/mobile/.../img.jpg' } as never,
    });
    await expect(downloadRongImageMessage(message)).resolves.toBe('file:///var/mobile/.../img.jpg');
  });

  it('融云私有存储地址（ronghub）仍走 SDK 下载链路', async () => {
    const message = receivedImage({
      imageUrl: 'https://img.ronghub.com/abc.jpg',
      mediaSource: { local: undefined } as never,
    });
    // 未连接融云时 SDK 下载应报错，而不是把 401 的 ronghub 地址直接吐给预览页
    await expect(downloadRongImageMessage(message)).rejects.toThrow();
  });

  it('非图片消息抛错', async () => {
    const message = { kind: 'text', text: 'hi' } as unknown as ManagedMessage;
    await expect(downloadRongImageMessage(message)).rejects.toThrow('消息不是图片');
  });
});
