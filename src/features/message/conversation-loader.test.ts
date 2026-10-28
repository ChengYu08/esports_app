import type { RCIMIWEngine } from '@rongcloud/react-native-im-wrapper';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/core/logging/logger', () => ({ logger: { warn: vi.fn() } }));

import { loadConversationSnapshot } from './conversation-loader';

const conversation = { targetId: '42', conversationType: 1, unreadCount: 2 };

function makeEngine(localConversations = [conversation]) {
  let conversations = localConversations;
  let synchronized: ((code: number) => void) | undefined;
  return {
    setOnRemoteConversationListSyncedListener: vi.fn<RCIMIWEngine['setOnRemoteConversationListSyncedListener']>((listener) => { synchronized = listener; }),
    getConversations: vi.fn<RCIMIWEngine['getConversations']>(async (_types, _channel, _time, _count, callback) => {
      callback?.onSuccess?.(conversations);
      return 0;
    }),
    getRemoteConversationList: vi.fn<RCIMIWEngine['getRemoteConversationList']>(async (callback) => {
      conversations = [conversation];
      callback?.onSuccess?.();
      synchronized?.(0);
      return 0;
    }),
    finishSync: (code = 0) => { conversations = [conversation]; synchronized?.(code); },
  };
}

describe('conversation loading', () => {
  afterEach(() => vi.useRealTimers());

  it('waits for database synchronization after the request is accepted', async () => {
    const engine = makeEngine([]);
    engine.getRemoteConversationList.mockImplementation(async (callback) => {
      callback?.onSuccess?.();
      return 0;
    });
    const snapshot = loadConversationSnapshot(engine, 1);
    await vi.waitFor(() => expect(engine.getRemoteConversationList).toHaveBeenCalled());
    expect(engine.getConversations).toHaveBeenCalledTimes(1);
    engine.finishSync();
    expect(await snapshot).toEqual([conversation]);
    expect(engine.setOnRemoteConversationListSyncedListener).toHaveBeenLastCalledWith();
  });

  it('shares a remote sync between concurrent reads', async () => {
    const engine = makeEngine([]);
    engine.getRemoteConversationList.mockResolvedValue(0);
    const snapshots = Promise.all([loadConversationSnapshot(engine, 1), loadConversationSnapshot(engine, 1)]);
    await vi.waitFor(() => expect(engine.getRemoteConversationList).toHaveBeenCalled());
    engine.finishSync();
    expect(await snapshots).toEqual([[conversation], [conversation]]);
    expect(engine.getRemoteConversationList).toHaveBeenCalledTimes(1);
  });

  it('reports synchronization failures even after the request was accepted', async () => {
    const engine = makeEngine([]);
    engine.getRemoteConversationList.mockResolvedValue(0);
    const snapshot = loadConversationSnapshot(engine, 1);
    const assertion = expect(snapshot).rejects.toThrow('33002');
    await vi.waitFor(() => expect(engine.getRemoteConversationList).toHaveBeenCalled());
    engine.finishSync(33002);
    await assertion;
  });

  it('times out and removes the sync listener when the SDK never completes', async () => {
    vi.useFakeTimers();
    const engine = makeEngine([]);
    engine.getRemoteConversationList.mockResolvedValue(0);
    const assertion = expect(loadConversationSnapshot(engine, 1)).rejects.toThrow('超时');
    await vi.advanceTimersByTimeAsync(15_000);
    await assertion;
    expect(engine.setOnRemoteConversationListSyncedListener).toHaveBeenLastCalledWith();
  });
  it('restores remote conversations when the local database is empty', async () => {
    expect(await loadConversationSnapshot(makeEngine([]), 1)).toEqual([conversation]);
  });

  it('keeps existing local conversations without requiring a remote request', async () => {
    const engine = makeEngine();
    engine.getRemoteConversationList.mockRejectedValue(new Error('offline'));
    expect(await loadConversationSnapshot(engine, 1)).toEqual([conversation]);
  });

  it('returns an empty list after both local and remote reads confirm no conversations', async () => {
    const engine = makeEngine([]);
    engine.getRemoteConversationList.mockImplementation(async (callback) => {
      callback?.onSuccess?.();
      engine.setOnRemoteConversationListSyncedListener.mock.calls.at(-1)?.[0]?.(0);
      return 0;
    });
    expect(await loadConversationSnapshot(engine, 1)).toEqual([]);
  });

  it('does not treat SDK callback failures as an empty conversation list', async () => {
    const engine = makeEngine();
    engine.getConversations.mockImplementation(async (_types, _channel, _time, _count, callback) => {
      callback?.onError?.(33001);
      return 0;
    });
    await expect(loadConversationSnapshot(engine, 1)).rejects.toThrow('33001');
  });

  it('does not treat rejected remote requests as an empty conversation list', async () => {
    const engine = makeEngine([]);
    engine.getRemoteConversationList.mockResolvedValue(33002);
    await expect(loadConversationSnapshot(engine, 1)).rejects.toThrow('33002');
  });

  it('returns an empty local list when remote sync is rejected for auto-pull (33302)', async () => {
    const engine = makeEngine([]);
    engine.getRemoteConversationList.mockResolvedValue(33302);
    await expect(loadConversationSnapshot(engine, 1)).resolves.toEqual([]);
    expect(engine.getConversations).toHaveBeenCalledTimes(2);
  });

  it('treats auto-pull (33302) from the sync listener as soft success', async () => {
    const engine = makeEngine([]);
    engine.getRemoteConversationList.mockImplementation(async (callback) => {
      callback?.onSuccess?.();
      return 0;
    });
    const snapshot = loadConversationSnapshot(engine, 1);
    await vi.waitFor(() => expect(engine.getRemoteConversationList).toHaveBeenCalled());
    engine.finishSync(33302);
    await expect(snapshot).resolves.toEqual([conversation]);
  });

  it('returns an empty local list when remote pull is not allowed (33301)', async () => {
    const engine = makeEngine([]);
    engine.getRemoteConversationList.mockResolvedValue(33301);
    await expect(loadConversationSnapshot(engine, 1)).resolves.toEqual([]);
    expect(engine.getConversations).toHaveBeenCalledTimes(2);
  });

  it('treats remote pull not allowed (33301) from the sync listener as soft success', async () => {
    const engine = makeEngine([]);
    engine.getRemoteConversationList.mockImplementation(async (callback) => {
      callback?.onSuccess?.();
      return 0;
    });
    const snapshot = loadConversationSnapshot(engine, 1);
    await vi.waitFor(() => expect(engine.getRemoteConversationList).toHaveBeenCalled());
    engine.finishSync(33301);
    await expect(snapshot).resolves.toEqual([conversation]);
  });
});
