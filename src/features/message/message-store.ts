import { useStore } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';

import { logger } from '@/core/logging/logger';
import {
  disconnectRongCloud,
  downloadRongImageMessage,
  getRongConversations,
  getRongMessages,
  initializeRongCloud,
  isRongCloudAvailable,
  markRongConversationRead,
  subscribeRongConnectionStatus,
  sendRongImage,
  sendRongText,
  sendRongAfterSaleCard,
  subscribeRongMessageEvents,
  subscribeRongMessages,
  type RongCloudConnectionSignal,
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
import { clientAuthApi } from '@/features/auth/client-auth.api';
import {
  readBlacklist,
  subscribeBlacklist,
  type BlacklistEntry,
} from '@/features/mine/blacklist';
import {
  getSystemConversationTitle,
  isSystemConversationId,
  normalizeSystemConversationId,
} from './system-conversations';
import { dispatchInAppNotification } from './notification-hub';

export type MessageConnectionState = 'idle' | 'connecting' | 'ready' | 'unavailable' | 'error';

export type MessageAdapter = {
  available: () => boolean;
  initialize: (token: string) => Promise<boolean>;
  getConversations: () => Promise<MessageConversation[]>;
  getMessages: (peerId: string, beforeSentTime?: number) => Promise<MessageHistoryPage>;
  sendText: (peerId: string, text: string) => Promise<ManagedMessage>;
  sendImage: (peerId: string, path: string) => Promise<ManagedMessage>;
  downloadImage?: (message: ManagedMessage) => Promise<string>;
  sendAfterSaleCard?: (peerId: string, payload: AfterSaleCardPayload) => Promise<ManagedMessage>;
  markRead: (peerId: string) => Promise<boolean>;
  subscribeConnectionStatus?: (listener: (signal: RongCloudConnectionSignal) => void) => () => void;
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
  blacklistedUserIds: string[];
  messagesByPeerId: Record<string, ManagedMessage[]>;
  historyByPeerId: Record<string, HistoryState>;
  openPeerIds: string[];
  activePeerId: string | null;
  lastError: string | null;
  refreshOnlineStatuses: (token: string) => Promise<void>;
  refreshConversations: (token: string) => Promise<void>;
  initialize: (token: string) => Promise<void>;
  openConversation: (conversation: Pick<MessageConversation, 'id' | 'title' | 'avatar' | 'clubId'>) => Promise<void>;
  closeConversation: (peerId?: string) => void;
  loadOlder: (peerId: string) => Promise<void>;
  sendText: (peerId: string, text: string) => Promise<void>;
  sendAfterSaleCard: (peerId: string, payload: import('@/features/order/after-sale-card').AfterSaleCardPayload) => Promise<boolean>;
  sendImage: (peerId: string, path: string) => Promise<void>;
  resolveImagePreview: (peerId: string, message: ManagedMessage) => Promise<string>;
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
    downloadImage: downloadRongImageMessage,
    sendAfterSaleCard: sendRongAfterSaleCard,
    markRead: markRongConversationRead,
    subscribeConnectionStatus: subscribeRongConnectionStatus,
    subscribeConversations: subscribeRongMessages,
    subscribeMessages: subscribeRongMessageEvents,
    disconnect: disconnectRongCloud,
  };
}

export function createMessageStore(adapter: MessageAdapter): StoreApi<MessageStoreState> {
  let stopMessageSubscription: (() => void) | undefined;
  let stopBlacklistSubscription: (() => void) | undefined;
  let stopConnectionStatusSubscription: (() => void) | undefined;
  let blacklistRevision = 0;
  let onlineStatusRequestId = 0;
  let onlineStatusToken: string | null = null;
  let hasInitialized = false;
  let initializeInProgress = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let reconnectAttempts = 0;
  let lifecycleRevision = 0;

  const store = createStore<MessageStoreState>((set, get) => {
    const applyBlacklist = (entries: BlacklistEntry[]) => {
      const userIds = [...new Set(entries.map((entry) => entry.userId))];
      const previousUserIds = new Set(get().blacklistedUserIds);
      const newlyBlocked = userIds.filter((userId) => !previousUserIds.has(userId));
      const blockedUserIds = new Set(userIds);
      set((state) => ({
        blacklistedUserIds: userIds,
        conversations: state.conversations.map((conversation) =>
          !isSystemConversationId(conversation.id) && blockedUserIds.has(conversation.id)
            ? { ...conversation, unreadCount: 0 }
            : conversation,
        ),
      }));
      if (get().connectionState === 'ready') {
        newlyBlocked.forEach((peerId) => {
          void adapter.markRead(peerId).catch(() => undefined);
        });
      }
    };

    const receiveMessage = (peerId: string, message: ManagedMessage, conversation: MessageConversation) => {
      const normalizedPeerId = normalizeSystemConversationId(peerId);
      const normalizedConversationTitle = getSystemConversationTitle(normalizedPeerId, conversation.title);
      const isActive = get().activePeerId === normalizedPeerId;
      const preview = message.kind === 'image'
        ? '[图片]'
        : message.kind === 'roomInvite'
          ? '[语聊房邀请]'
          : message.kind === 'afterSale' || message.kind === 'orderNotify'
          ? message.title
          : message.text;
      logger.info('message.new', {
        peerId: normalizedPeerId,
        conversationTitle: normalizedConversationTitle,
        messageId: message.id,
        messageKind: message.kind,
        preview: preview || '新消息',
        isSystemConversation: isSystemConversationId(normalizedPeerId),
        isMine: message.isMine,
        isActive,
        sentAt: message.sentAt,
      });
      if (
        !isSystemConversationId(normalizedPeerId)
        && get().blacklistedUserIds.includes(normalizedPeerId)
      ) {
        void adapter.markRead(normalizedPeerId).catch(() => undefined);
        return;
      }
      const normalizedConversation = { ...conversation, id: normalizedPeerId, title: normalizedConversationTitle };
      if (!isActive && !message.isMine) {
        dispatchInAppNotification({
          peerId: normalizedPeerId,
          title: getSystemConversationTitle(normalizedPeerId, normalizedConversation.title),
          preview: preview || '新消息',
          avatar: normalizedConversation.avatar,
          isSystem: isSystemConversationId(normalizedPeerId),
        });
      }
      set((state) => {
        const existing = state.conversations.find((item) => item.id === normalizedPeerId);
        const nextConversation: MessageConversation = {
          ...normalizedConversation,
          title: getSystemConversationTitle(normalizedPeerId, existing?.title || normalizedConversation.title),
          avatar: existing?.avatar || normalizedConversation.avatar,
          isOnline: message.isMine ? existing?.isOnline : true,
          unreadCount: isActive ? 0 : (existing?.unreadCount || 0) + 1,
          updatedAt: message.sentAt,
        };
        return {
          messagesByPeerId: state.openPeerIds.includes(normalizedPeerId)
            ? { ...state.messagesByPeerId, [normalizedPeerId]: mergeMessages(state.messagesByPeerId[normalizedPeerId] || [], message) }
            : state.messagesByPeerId,
          conversations: mergeConversations(state.conversations, nextConversation),
        };
      });
      if (isActive) void adapter.markRead(normalizedPeerId).catch((error) => set({ lastError: error instanceof Error ? error.message : '清除未读失败' }));
    };

    const updateLocalPreview = (peerId: string, message: ManagedMessage) => {
        const preview = message.kind === 'image'
          ? '[图片]'
          : message.kind === 'roomInvite'
            ? '[语聊房邀请]'
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
      set((state) => {
        if (!state.openPeerIds.includes(peerId)) return state;
        return {
          messagesByPeerId: { ...state.messagesByPeerId, [peerId]: beforeSentTime ? prependHistory(state.messagesByPeerId[peerId] || [], page.messages) : page.messages },
          historyByPeerId: { ...state.historyByPeerId, [peerId]: { nextCursor: page.nextCursor, hasMore: page.hasMore, loading: false } },
        };
      });
    };

    const syncConversations = async (expectedLifecycleRevision = lifecycleRevision) => {
      const conversations = await adapter.getConversations();
      if (expectedLifecycleRevision !== lifecycleRevision) return;
      const blockedUserIds = new Set(get().blacklistedUserIds);
      const blockedConversationIds = conversations
        .filter((conversation) =>
          !isSystemConversationId(conversation.id)
          && blockedUserIds.has(conversation.id),
        )
        .map((conversation) => conversation.id);
      set((state) => ({
        conversations: conversations
          .map((conversation) =>
            !isSystemConversationId(conversation.id) && blockedUserIds.has(conversation.id)
              ? { ...conversation, unreadCount: 0 }
              : conversation,
          )
          .reduce(mergeConversations, state.conversations),
      }));
      if (onlineStatusToken) void get().refreshOnlineStatuses(onlineStatusToken);
      await Promise.allSettled(blockedConversationIds.map((peerId) => adapter.markRead(peerId)));
    };

    const scheduleReconnect = () => {
      if (reconnectTimer || !onlineStatusToken) return;
      const delayMs = Math.min(1_000 * 2 ** Math.min(reconnectAttempts, 5), 30_000);
      reconnectAttempts += 1;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = undefined;
        const token = onlineStatusToken;
        if (token) void get().initialize(token);
      }, delayMs);
    };

    const watchConnectionStatus = () => {
      if (stopConnectionStatusSubscription) return;
      const stopListening = adapter.subscribeConnectionStatus?.((signal) => {
        if (signal === 'connected') {
          if (reconnectTimer) clearTimeout(reconnectTimer);
          reconnectTimer = undefined;
          reconnectAttempts = 0;
          if (!hasInitialized || initializeInProgress) return;
          set({ connectionState: 'ready', lastError: null });
          void syncConversations(lifecycleRevision).catch((error) => {
            logger.warn('RongCloud conversation sync after reconnect failed', {
              stage: 'reconnect-sync',
              errorName: error instanceof Error ? error.name : typeof error,
            });
          });
          return;
        }
        if (signal === 'connecting') {
          if (hasInitialized || get().connectionState === 'ready') {
            set({ connectionState: 'connecting', lastError: null });
          }
          return;
        }
        if (signal === 'timeout') {
          if (get().connectionState === 'idle' || get().connectionState === 'unavailable') return;
          set({ connectionState: 'error', lastError: '即时消息连接超时，正在自动重连' });
          scheduleReconnect();
          return;
        }
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = undefined;
        if (get().connectionState !== 'idle' && get().connectionState !== 'unavailable') {
          set({ connectionState: 'error', lastError: '即时消息连接失败，请检查登录状态后重试' });
        }
      });
      if (stopListening) stopConnectionStatusSubscription = stopListening;
    };

    return {
      connectionState: 'idle',
      conversations: [],
      blacklistedUserIds: [],
      messagesByPeerId: {},
      historyByPeerId: {},
      openPeerIds: [],
      activePeerId: null,
      lastError: null,

      refreshOnlineStatuses: async (token) => {
        const requestId = ++onlineStatusRequestId;
        if (!token) return;
        const userIds = Array.from(new Set(
          get().conversations
            .filter((conversation) => !isSystemConversationId(conversation.id))
            .map((conversation) => normalizeSystemConversationId(conversation.id))
            .filter(Boolean),
        ));

        try {
          const statuses: Record<string, number> = userIds.length > 0
            ? await clientAuthApi.getUserOnlineStatus(token, userIds)
            : {};
          if (requestId !== onlineStatusRequestId) return;
          const requestedIds = new Set(userIds);
          set((state) => ({
            conversations: state.conversations.map((conversation) => {
              if (isSystemConversationId(conversation.id)) {
                return conversation.isOnline ? { ...conversation, isOnline: false } : conversation;
              }
              if (!requestedIds.has(conversation.id)) return conversation;
              return { ...conversation, isOnline: Number(statuses[conversation.id]) === 1 };
            }),
          }));
        } catch {
          // Keep the previous snapshot if the request fails.
        }
      },

      refreshConversations: async (token) => {
        if (!token) return;
        onlineStatusToken = token;
        if (get().connectionState === 'ready') {
          try {
            await syncConversations(lifecycleRevision);
          } catch (error) {
            logger.warn('Message conversation refresh failed', {
              stage: 'message-conversation-refresh',
              errorName: error instanceof Error ? error.name : typeof error,
            });
          }
          return;
        }
        await get().initialize(token);
      },

      initialize: async (token) => {
        const initializationRevision = lifecycleRevision;
        onlineStatusToken = token || null;
        if (!stopBlacklistSubscription) {
          stopBlacklistSubscription = subscribeBlacklist((entries) => {
            blacklistRevision += 1;
            applyBlacklist(entries);
          });
        }
        const revision = blacklistRevision;
        const entries = await readBlacklist();
        if (initializationRevision !== lifecycleRevision) return;
        if (revision === blacklistRevision) applyBlacklist(entries);
        if (!token) return;
        if (get().connectionState === 'connecting' || get().connectionState === 'ready') return;
        if (!adapter.available()) {
          set({ connectionState: 'unavailable', lastError: unavailableMessage });
          return;
        }
        watchConnectionStatus();
        set({ connectionState: 'connecting', lastError: null });
        initializeInProgress = true;
        try {
          const ready = await adapter.initialize(token);
          if (initializationRevision !== lifecycleRevision) return;
          if (!ready) {
            initializeInProgress = false;
            logger.warn('Instant messaging adapter initialization returned false', {
              stage: 'adapter-initialize',
            });
            set({ connectionState: 'error', lastError: '即时消息连接失败，请稍后重试' });
            return;
          }
          await syncConversations(initializationRevision);
          if (initializationRevision !== lifecycleRevision) return;
          stopMessageSubscription?.();
          stopMessageSubscription = adapter.subscribeMessages(receiveMessage);
          hasInitialized = true;
          initializeInProgress = false;
          set({ connectionState: 'ready', lastError: null });
        } catch (error) {
          if (initializationRevision !== lifecycleRevision) return;
          initializeInProgress = false;
          logger.warn('Instant messaging initialization threw an error', {
            stage: 'message-store-initialize',
            errorName: error instanceof Error ? error.name : typeof error,
          });
          set({ connectionState: 'error', lastError: error instanceof Error ? error.message : '即时消息连接失败，请稍后重试' });
        }
      },

      openConversation: async (conversation) => {
        const isNewConversation = !get().conversations.some((item) => item.id === conversation.id);
        set((state) => {
          const current = state.conversations.find((item) => item.id === conversation.id);
          return {
            activePeerId: conversation.id,
            openPeerIds: [...state.openPeerIds, conversation.id],
            conversations: mergeConversations(state.conversations, { ...(current || toConversationShell(conversation)), ...conversation }),
          };
        });
        if (isNewConversation && onlineStatusToken) {
          void get().refreshOnlineStatuses(onlineStatusToken);
        }
        // Update the local unread state immediately, even if IM is offline or
        // history loading takes time. markRead forwards to the adapter when ready.
        void get().markRead(conversation.id);
        if (get().connectionState !== 'ready') return;
        const previous = get().historyByPeerId[conversation.id];
        if (!previous) {
          set((state) => ({ historyByPeerId: { ...state.historyByPeerId, [conversation.id]: { nextCursor: null, hasMore: true, loading: true } } }));
          try { await loadHistory(conversation.id); } catch (error) {
            set((state) => {
              if (!state.openPeerIds.includes(conversation.id)) return state;
              return {
                historyByPeerId: { ...state.historyByPeerId, [conversation.id]: { nextCursor: null, hasMore: false, loading: false } },
                lastError: error instanceof Error ? error.message : '历史消息加载失败',
              };
            });
          }
        }
      },

      closeConversation: (peerId) => {
        const state = get();
        const closingPeerId = peerId || state.activePeerId || state.openPeerIds.at(-1);
        if (!closingPeerId) return;

        const closingIndex = state.openPeerIds.lastIndexOf(closingPeerId);
        if (closingIndex < 0) return;
        const openPeerIds = state.openPeerIds.filter((_, index) => index !== closingIndex);
        const stillOpen = openPeerIds.includes(closingPeerId);
        const messagesByPeerId = { ...state.messagesByPeerId };
        const historyByPeerId = { ...state.historyByPeerId };
        if (!stillOpen) {
          delete messagesByPeerId[closingPeerId];
          delete historyByPeerId[closingPeerId];
        }

        const activePeerId = state.activePeerId === closingPeerId
          ? (stillOpen ? closingPeerId : openPeerIds.at(-1)) || null
          : state.activePeerId;
        set({ activePeerId, openPeerIds, messagesByPeerId, historyByPeerId });
        if (state.activePeerId === closingPeerId && activePeerId) {
          void get().markRead(activePeerId);
        }
      },

      loadOlder: async (peerId) => {
        if (get().connectionState !== 'ready') return;
        const history = get().historyByPeerId[peerId];
        if (!history || history.loading || !history.hasMore) return;
        set((state) => ({ historyByPeerId: { ...state.historyByPeerId, [peerId]: { ...history, loading: true } } }));
        try { await loadHistory(peerId, history.nextCursor || undefined); } catch (error) { set((state) => state.openPeerIds.includes(peerId) ? ({ historyByPeerId: { ...state.historyByPeerId, [peerId]: { ...history, loading: false } }, lastError: error instanceof Error ? error.message : '历史消息加载失败' }) : state); }
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

      resolveImagePreview: async (peerId, message) => {
        if (message.kind !== 'image') throw new Error('消息不是图片');
        const imageUrl = adapter.downloadImage
          ? await adapter.downloadImage(message)
          : message.imageUrl;
        set((state) => ({
          messagesByPeerId: {
            ...state.messagesByPeerId,
            [peerId]: (state.messagesByPeerId[peerId] || []).map((item) =>
              item.id === message.id && item.kind === 'image'
                ? { ...item, imageUrl }
                : item,
            ),
          },
        }));
        return imageUrl;
      },

      sendAfterSaleCard: async (peerId, payload) => {
        if (get().connectionState !== 'ready') { set({ lastError: unavailableMessage }); return false; }
        try {
          const sendCard = adapter.sendAfterSaleCard;
          if (!sendCard) { set({ lastError: '当前版本暂不支持售后卡片' }); return false; }
          const sent = await sendCard(peerId, payload);
          set((state) => ({ messagesByPeerId: { ...state.messagesByPeerId, [peerId]: mergeMessages(state.messagesByPeerId[peerId] || [], sent) } }));
          updateLocalPreview(peerId, sent);
          return true;
        } catch (error) { set({ lastError: error instanceof Error ? error.message : '发送售后卡片失败' }); return false; }
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
        lifecycleRevision += 1;
        onlineStatusRequestId += 1;
        onlineStatusToken = null;
        hasInitialized = false;
        initializeInProgress = false;
        reconnectAttempts = 0;
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = undefined;
        stopMessageSubscription?.();
        stopBlacklistSubscription?.();
        stopConnectionStatusSubscription?.();
        stopMessageSubscription = undefined;
        stopBlacklistSubscription = undefined;
        stopConnectionStatusSubscription = undefined;
        await adapter.disconnect();
        set({ connectionState: 'idle', conversations: [], blacklistedUserIds: [], messagesByPeerId: {}, historyByPeerId: {}, openPeerIds: [], activePeerId: null, lastError: null });
      },
    };
  });

  return store;
}

export const messageStore = createMessageStore(createAdapter());

export function useMessageStore<T>(selector: (state: MessageStoreState) => T) {
  return useStore(messageStore, selector);
}
