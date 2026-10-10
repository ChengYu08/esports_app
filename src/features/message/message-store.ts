import { useStore } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';

import {
  disconnectRongCloud,
  getRongConversations,
  getRongMessages,
  initializeRongCloud,
  isRongCloudAvailable,
  markRongConversationRead,
  sendRongImage,
  sendRongText,
  sendRongAfterSaleCard,
  subscribeRongMessageEvents,
  subscribeRongMessages,
} from './rongcloud-im';
import {
  markMessageFailed,
  mergeConversations,
  mergeMessages,
  prependHistory,
  replacePendingMessage,
  type ManagedMessage,
  type MessageConversation,
  type MessageHistoryPage,
} from './message-state';
import type { AfterSaleCardPayload } from '@/features/order/after-sale-card';
import { getSystemConversationTitle, normalizeSystemConversationId } from './system-conversations';

export type MessageConnectionState = 'idle' | 'connecting' | 'ready' | 'unavailable' | 'error';

export type MessageAdapter = {
  available: () => boolean;
  initialize: (token: string) => Promise<boolean>;
  getConversations: () => Promise<MessageConversation[]>;
  getMessages: (peerId: string, beforeSentTime?: number) => Promise<MessageHistoryPage>;
  sendText: (peerId: string, text: string) => Promise<ManagedMessage>;
  sendImage: (peerId: string, path: string) => Promise<ManagedMessage>;
  sendAfterSaleCard?: (peerId: string, payload: AfterSaleCardPayload) => Promise<ManagedMessage>;
  markRead: (peerId: string) => Promise<boolean>;
  subscribeConversations: (listener: (conversation: MessageConversation) => void) => () => void;
  subscribeMessages: (listener: (peerId: string, message: ManagedMessage, conversation: MessageConversation) => void) => () => void;
  disconnect: () => Promise<void>;
};

type HistoryState = {
  nextCursor: number | null;
  hasMore: boolean;
  loading: boolean;
};

export type MessageStoreState = {
  connectionState: MessageConnectionState;
  conversations: MessageConversation[];
  messagesByPeerId: Record<string, ManagedMessage[]>;
  historyByPeerId: Record<string, HistoryState>;
  activePeerId: string | null;
  lastError: string | null;
  initialize: (token: string) => Promise<void>;
  openConversation: (conversation: Pick<MessageConversation, 'id' | 'title' | 'avatar' | 'clubId'>) => Promise<void>;
  closeConversation: () => void;
  loadOlder: (peerId: string) => Promise<void>;
  sendText: (peerId: string, text: string) => Promise<void>;
  sendAfterSaleCard: (peerId: string, payload: import('@/features/order/after-sale-card').AfterSaleCardPayload) => Promise<void>;
  sendImage: (peerId: string, path: string) => Promise<void>;
  retryMessage: (peerId: string, clientId: string) => Promise<void>;
  markRead: (peerId: string) => Promise<void>;
  setConversationNote: (peerId: string, note: string) => void;
  setConversationPinned: (peerId: string, isPinned: boolean) => void;
  clearAllUnread: () => Promise<void>;
  reset: () => Promise<void>;
};

const unavailableMessage = '当前版本暂不支持即时消息';
let clientSequence = 0;

function now() {
  return Date.now();
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function makeClientId() {
  clientSequence += 1;
  return `local-${now()}-${clientSequence}`;
}

function createPendingText(peerId: string, text: string): ManagedMessage {
  const sentAt = now();
  const clientId = makeClientId();
  return { id: clientId, clientId, kind: 'text', text, time: formatTime(sentAt), isMine: true, status: 'pending', sentAt, retryPayload: { kind: 'text', text } };
}

function createPendingImage(path: string): ManagedMessage {
  const sentAt = now();
  const clientId = makeClientId();
  return { id: clientId, clientId, kind: 'image', imageUrl: path, time: formatTime(sentAt), isMine: true, status: 'pending', sentAt, retryPayload: { kind: 'image', path } };
}

function toConversationShell(conversation: Pick<MessageConversation, 'id' | 'title' | 'avatar'>): MessageConversation {
  const id = normalizeSystemConversationId(conversation.id);
  return { ...conversation, id, title: getSystemConversationTitle(id, conversation.title), preview: '', time: '', unreadCount: 0, updatedAt: 0 };
}

function createAdapter(): MessageAdapter {
  return {
    available: isRongCloudAvailable,
    initialize: initializeRongCloud,
    getConversations: getRongConversations,
    getMessages: getRongMessages,
    sendText: sendRongText,
    sendImage: sendRongImage,
    sendAfterSaleCard: sendRongAfterSaleCard,
    markRead: markRongConversationRead,
    subscribeConversations: subscribeRongMessages,
    subscribeMessages: subscribeRongMessageEvents,
    disconnect: disconnectRongCloud,
  };
}

export function createMessageStore(adapter: MessageAdapter): StoreApi<MessageStoreState> {
  let stopConversationSubscription: (() => void) | undefined;
  let stopMessageSubscription: (() => void) | undefined;

  const store = createStore<MessageStoreState>((set, get) => {
    const receiveConversation = (conversation: MessageConversation) => {
      const normalizedConversation = {
        ...conversation,
        id: normalizeSystemConversationId(conversation.id),
        title: getSystemConversationTitle(conversation.id, conversation.title),
      };
      set((state) => {
        const existing = state.conversations.find((item) => item.id === normalizedConversation.id || normalizeSystemConversationId(item.id) === normalizedConversation.id);
        return { conversations: mergeConversations(state.conversations, { ...normalizedConversation, unreadCount: existing?.unreadCount || 0 }) };
      });
    };

    const receiveMessage = (peerId: string, message: ManagedMessage, conversation: MessageConversation) => {
      const normalizedPeerId = normalizeSystemConversationId(peerId);
      const normalizedConversation = { ...conversation, id: normalizedPeerId, title: getSystemConversationTitle(normalizedPeerId, conversation.title) };
      const isActive = get().activePeerId === normalizedPeerId;
      set((state) => {
        const existing = state.conversations.find((item) => item.id === normalizedPeerId);
        const nextConversation: MessageConversation = {
          ...normalizedConversation,
          title: getSystemConversationTitle(normalizedPeerId, existing?.title || normalizedConversation.title),
          avatar: existing?.avatar || normalizedConversation.avatar,
          unreadCount: isActive ? 0 : (existing?.unreadCount || 0) + 1,
          updatedAt: message.sentAt,
        };
        return {
          messagesByPeerId: { ...state.messagesByPeerId, [normalizedPeerId]: mergeMessages(state.messagesByPeerId[normalizedPeerId] || [], message) },
          conversations: mergeConversations(state.conversations, nextConversation),
        };
      });
      if (isActive) void adapter.markRead(normalizedPeerId).catch((error) => set({ lastError: error instanceof Error ? error.message : '清除未读失败' }));
    };

    const updateLocalPreview = (peerId: string, message: ManagedMessage) => {
        const preview = message.kind === 'image'
          ? '[图片]'
          : message.kind === 'afterSale' || message.kind === 'orderNotify'
            ? message.title
            : message.text;
      set((state) => {
        const existing = state.conversations.find((item) => item.id === peerId) || toConversationShell({ id: peerId, title: peerId });
        return { conversations: mergeConversations(state.conversations, { ...existing, preview, time: message.time, updatedAt: message.sentAt }) };
      });
    };

    const loadHistory = async (peerId: string, beforeSentTime?: number) => {
      const page = await adapter.getMessages(peerId, beforeSentTime);
      set((state) => ({
        messagesByPeerId: { ...state.messagesByPeerId, [peerId]: beforeSentTime ? prependHistory(state.messagesByPeerId[peerId] || [], page.messages) : page.messages },
        historyByPeerId: { ...state.historyByPeerId, [peerId]: { nextCursor: page.nextCursor, hasMore: page.hasMore, loading: false } },
      }));
    };

    return {
      connectionState: 'idle',
      conversations: [],
      messagesByPeerId: {},
      historyByPeerId: {},
      activePeerId: null,
      lastError: null,

      initialize: async (token) => {
        if (!token) return;
        if (get().connectionState === 'connecting' || get().connectionState === 'ready') return;
        if (!adapter.available()) {
          set({ connectionState: 'unavailable', lastError: unavailableMessage });
          return;
        }
        set({ connectionState: 'connecting', lastError: null });
        try {
          const ready = await adapter.initialize(token);
          if (!ready) {
            set({ connectionState: 'error', lastError: '即时消息连接失败，请稍后重试' });
            return;
          }
          set({ connectionState: 'ready', lastError: null });
          const conversations = await adapter.getConversations();
          set((state) => ({ conversations: conversations.reduce(mergeConversations, state.conversations) }));
          stopConversationSubscription?.();
          stopMessageSubscription?.();
          stopConversationSubscription = adapter.subscribeConversations(receiveConversation);
          stopMessageSubscription = adapter.subscribeMessages(receiveMessage);
        } catch (error) {
          set({ connectionState: 'error', lastError: error instanceof Error ? error.message : '即时消息连接失败，请稍后重试' });
        }
      },

      openConversation: async (conversation) => {
        set((state) => {
          const current = state.conversations.find((item) => item.id === conversation.id);
          return { activePeerId: conversation.id, conversations: mergeConversations(state.conversations, { ...(current || toConversationShell(conversation)), ...conversation }) };
        });
        if (get().connectionState !== 'ready') return;
        const previous = get().historyByPeerId[conversation.id];
        if (!previous) {
          set((state) => ({ historyByPeerId: { ...state.historyByPeerId, [conversation.id]: { nextCursor: null, hasMore: true, loading: true } } }));
          try { await loadHistory(conversation.id); } catch (error) {
            set((state) => ({
              historyByPeerId: { ...state.historyByPeerId, [conversation.id]: { nextCursor: null, hasMore: false, loading: false } },
              lastError: error instanceof Error ? error.message : '历史消息加载失败',
            }));
          }
        }
        await get().markRead(conversation.id);
      },

      closeConversation: () => set({ activePeerId: null }),

      loadOlder: async (peerId) => {
        if (get().connectionState !== 'ready') return;
        const history = get().historyByPeerId[peerId];
        if (!history || history.loading || !history.hasMore) return;
        set((state) => ({ historyByPeerId: { ...state.historyByPeerId, [peerId]: { ...history, loading: true } } }));
        try { await loadHistory(peerId, history.nextCursor || undefined); } catch (error) { set((state) => ({ historyByPeerId: { ...state.historyByPeerId, [peerId]: { ...history, loading: false } }, lastError: error instanceof Error ? error.message : '历史消息加载失败' })); }
      },

      sendText: async (peerId, text) => {
        const value = text.trim();
        if (!value) return;
        if (get().connectionState !== 'ready') { set({ lastError: unavailableMessage }); return; }
        const pending = createPendingText(peerId, value);
        set((state) => ({ messagesByPeerId: { ...state.messagesByPeerId, [peerId]: mergeMessages(state.messagesByPeerId[peerId] || [], pending) } }));
        updateLocalPreview(peerId, pending);
        try {
          const sent = await adapter.sendText(peerId, value);
          set((state) => ({ messagesByPeerId: { ...state.messagesByPeerId, [peerId]: replacePendingMessage(state.messagesByPeerId[peerId] || [], pending.clientId || pending.id, sent) } }));
          updateLocalPreview(peerId, sent);
        } catch (error) {
          set((state) => ({ messagesByPeerId: { ...state.messagesByPeerId, [peerId]: markMessageFailed(state.messagesByPeerId[peerId] || [], pending.clientId || pending.id) }, lastError: error instanceof Error ? error.message : '发送消息失败' }));
        }
      },

      sendImage: async (peerId, path) => {
        if (get().connectionState !== 'ready') { set({ lastError: unavailableMessage }); return; }
        const pending = createPendingImage(path);
        set((state) => ({ messagesByPeerId: { ...state.messagesByPeerId, [peerId]: mergeMessages(state.messagesByPeerId[peerId] || [], pending) } }));
        updateLocalPreview(peerId, pending);
        try {
          const sent = await adapter.sendImage(peerId, path);
          set((state) => ({ messagesByPeerId: { ...state.messagesByPeerId, [peerId]: replacePendingMessage(state.messagesByPeerId[peerId] || [], pending.clientId || pending.id, sent) } }));
          updateLocalPreview(peerId, sent);
        } catch (error) {
          set((state) => ({ messagesByPeerId: { ...state.messagesByPeerId, [peerId]: markMessageFailed(state.messagesByPeerId[peerId] || [], pending.clientId || pending.id) }, lastError: error instanceof Error ? error.message : '发送图片失败' }));
        }
      },

      sendAfterSaleCard: async (peerId, payload) => {
        if (get().connectionState !== 'ready') { set({ lastError: unavailableMessage }); return; }
        try {
          const sendCard = adapter.sendAfterSaleCard;
          if (!sendCard) { set({ lastError: '当前版本暂不支持售后卡片' }); return; }
          const sent = await sendCard(peerId, payload);
          set((state) => ({ messagesByPeerId: { ...state.messagesByPeerId, [peerId]: mergeMessages(state.messagesByPeerId[peerId] || [], sent) } }));
          updateLocalPreview(peerId, sent);
        } catch (error) { set({ lastError: error instanceof Error ? error.message : '发送售后卡片失败' }); }
      },

      retryMessage: async (peerId, clientId) => {
        const item = get().messagesByPeerId[peerId]?.find((message) => message.clientId === clientId);
        if (!item?.retryPayload) return;
        set((state) => ({ messagesByPeerId: { ...state.messagesByPeerId, [peerId]: state.messagesByPeerId[peerId].map((message) => message.clientId === clientId ? { ...message, status: 'pending' as const } : message) } }));
        try {
          const sent = item.retryPayload.kind === 'text' ? await adapter.sendText(peerId, item.retryPayload.text) : await adapter.sendImage(peerId, item.retryPayload.path);
          set((state) => ({ messagesByPeerId: { ...state.messagesByPeerId, [peerId]: replacePendingMessage(state.messagesByPeerId[peerId] || [], clientId, sent) } }));
          updateLocalPreview(peerId, sent);
        } catch (error) {
          set((state) => ({ messagesByPeerId: { ...state.messagesByPeerId, [peerId]: markMessageFailed(state.messagesByPeerId[peerId] || [], clientId) }, lastError: error instanceof Error ? error.message : '发送消息失败' }));
        }
      },

      markRead: async (peerId) => {
        set((state) => ({ conversations: state.conversations.map((item) => item.id === peerId ? { ...item, unreadCount: 0 } : item) }));
        if (get().connectionState !== 'ready') return;
        try { await adapter.markRead(peerId); } catch (error) { set({ lastError: error instanceof Error ? error.message : '清除未读失败' }); }
      },

      setConversationNote: (peerId, note) => set((state) => ({
        conversations: state.conversations.map((conversation) => conversation.id === peerId ? { ...conversation, note } : conversation),
      })),

      setConversationPinned: (peerId, isPinned) => set((state) => ({
        conversations: state.conversations
          .map((conversation) => conversation.id === peerId ? { ...conversation, isPinned } : conversation)
          .sort((left, right) => Number(Boolean(right.isPinned)) - Number(Boolean(left.isPinned)) || right.updatedAt - left.updatedAt),
      })),

      clearAllUnread: async () => {
        const peerIds = get().conversations
          .filter((conversation) => conversation.unreadCount > 0)
          .map((conversation) => conversation.id);
        set((state) => ({
          conversations: state.conversations.map((conversation) => ({ ...conversation, unreadCount: 0 })),
        }));
        if (get().connectionState !== 'ready' || peerIds.length === 0) return;
        const results = await Promise.allSettled(peerIds.map((peerId) => adapter.markRead(peerId)));
        const failure = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
        if (failure) {
          set({ lastError: failure.reason instanceof Error ? failure.reason.message : '清除未读失败' });
        }
      },

      reset: async () => {
        stopConversationSubscription?.();
        stopMessageSubscription?.();
        stopConversationSubscription = undefined;
        stopMessageSubscription = undefined;
        await adapter.disconnect();
        set({ connectionState: 'idle', conversations: [], messagesByPeerId: {}, historyByPeerId: {}, activePeerId: null, lastError: null });
      },
    };
  });

  return store;
}

export const messageStore = createMessageStore(createAdapter());

export function useMessageStore<T>(selector: (state: MessageStoreState) => T) {
  return useStore(messageStore, selector);
}
