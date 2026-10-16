import { describe, expect, it, vi } from 'vitest';

import { createMessageStore, type MessageAdapter } from './message-store';
import type { ManagedMessage, MessageConversation, MessageHistoryPage } from './message-state';

const conversation: MessageConversation = { id: '42', title: 'Peer', preview: '', time: '', unreadCount: 0, updatedAt: 1 };
const sentMessage: ManagedMessage = { id: 'server-1', kind: 'text', text: 'hello', time: '10:00', isMine: true, status: 'sent', sentAt: 10 };

function makeAdapter(overrides: Partial<MessageAdapter> = {}) {
  const adapter: MessageAdapter = {
    available: () => true,
    initialize: vi.fn(async () => true),
    getConversations: vi.fn(async () => []),
    getMessages: vi.fn(async (): Promise<MessageHistoryPage> => ({ messages: [], nextCursor: null, hasMore: false })),
    sendText: vi.fn(async () => sentMessage),
    sendImage: vi.fn(async () => sentMessage),
    markRead: vi.fn(async () => true),
    subscribeConversations: vi.fn(() => () => undefined),
    subscribeMessages: vi.fn(() => () => undefined),
    disconnect: vi.fn(async () => undefined),
    ...overrides,
  };
  return adapter;
}

describe('message store', () => {
  it('does not create a local message while IM is unavailable', async () => {
    const store = createMessageStore(makeAdapter({ available: () => false }));
    await store.getState().initialize('token');
    await store.getState().sendText('42', 'hello');
    expect(store.getState().messagesByPeerId['42']).toBeUndefined();
    expect(store.getState().lastError).toBe('当前版本暂不支持即时消息');
  });

  it('replaces pending text after the adapter confirms it', async () => {
    const store = createMessageStore(makeAdapter());
    await store.getState().initialize('token');
    await store.getState().sendText('42', 'hello');
    expect(store.getState().messagesByPeerId['42']).toEqual([sentMessage]);
  });

  it('keeps failed sends retryable', async () => {
    const adapter = makeAdapter({ sendText: vi.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(sentMessage) });
    const store = createMessageStore(adapter);
    await store.getState().initialize('token');
    await store.getState().sendText('42', 'hello');
    const failed = store.getState().messagesByPeerId['42'][0];
    expect(failed.status).toBe('failed');
    await store.getState().retryMessage('42', failed.clientId || '');
    expect(store.getState().messagesByPeerId['42']).toEqual([sentMessage]);
  });

  it('increments unread for inactive incoming messages and clears it for active peers', async () => {
    let receiveConversation: ((value: MessageConversation) => void) | undefined;
    let receiveMessage: ((peerId: string, message: ManagedMessage, value: MessageConversation) => void) | undefined;
    const store = createMessageStore(makeAdapter({
      subscribeConversations: vi.fn((callback) => { receiveConversation = callback; return () => undefined; }),
      subscribeMessages: vi.fn((callback) => { receiveMessage = callback; return () => undefined; }),
    }));
    await store.getState().initialize('token');
    receiveConversation?.(conversation);
    receiveMessage?.('42', { ...sentMessage, isMine: false }, { ...conversation, preview: 'hello', updatedAt: 10 });
    expect(store.getState().conversations[0].unreadCount).toBe(1);
    expect(store.getState().conversations[0].isOnline).toBe(true);
    await store.getState().openConversation({ id: '42', title: 'Peer' });
    expect(store.getState().conversations[0].unreadCount).toBe(0);
  });

  it('clears unread counts for every conversation and marks unread peers as read', async () => {
    const markRead = vi.fn(async () => true);
    const store = createMessageStore(makeAdapter({
      markRead,
      getConversations: vi.fn(async () => [
        { ...conversation, unreadCount: 2 },
        { ...conversation, id: '7', unreadCount: 0 },
      ]),
    }));
    await store.getState().initialize('token');
    await store.getState().clearAllUnread();
    expect(store.getState().conversations.every((item) => item.unreadCount === 0)).toBe(true);
    expect(markRead).toHaveBeenCalledTimes(1);
    expect(markRead).toHaveBeenCalledWith('42');
  });

  it('updates a conversation note and pin state without changing its message data', async () => {
    const store = createMessageStore(makeAdapter({ getConversations: vi.fn(async () => [conversation]) }));
    await store.getState().initialize('token');
    store.getState().setConversationNote('42', '常用陪玩');
    store.getState().setConversationPinned('42', true);
    expect(store.getState().conversations[0]).toMatchObject({ id: '42', note: '常用陪玩', isPinned: true });
  });

  it('loads older history only once per cursor and prepends it', async () => {
    const older: ManagedMessage = { ...sentMessage, id: 'old', sentAt: 1, time: '09:00' };
    const adapter = makeAdapter({
      getMessages: vi.fn()
        .mockResolvedValueOnce({ messages: [sentMessage], nextCursor: 10, hasMore: true })
        .mockResolvedValueOnce({ messages: [older], nextCursor: null, hasMore: false }),
    });
    const store = createMessageStore(adapter);
    await store.getState().initialize('token');
    await store.getState().openConversation({ id: '42', title: 'Peer' });
    await store.getState().loadOlder('42');
    await store.getState().loadOlder('42');
    expect(adapter.getMessages).toHaveBeenCalledTimes(2);
    expect(store.getState().messagesByPeerId['42'].map((item) => item.id)).toEqual(['old', 'server-1']);
  });
});
