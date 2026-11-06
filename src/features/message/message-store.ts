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
  isRongCloudConnected,
  markRongConversationRead,
  subscribeRongConnectionStatus,
  subscribeRongConversationSync,
  subscribeRongConversationReadSync,
  sendRongImage,
  sendRongText,
  sendRongAfterSaleCard,
  setRongConversationPinned,
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
import { messagePreview } from './chat-message';
import { clearCsInviteClaimStates } from './cs-invite-claim-state';
import { clientAuthApi } from '@/features/auth/client-auth.api';
import {
  readBlacklist,
  subscribeBlacklist,
  type BlacklistEntry,
} from '@/features/mine/blacklist';
import {
  ensureNotificationSettingsLoaded,
  isMessageNotificationMuted,
} from '@/features/mine/notification-settings';
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
  /** SDK 长连接是否实际处于已连接状态（区别于 store 的 connectionState 标记） */
  isConnected?: () => boolean;
  getConversations: () => Promise<MessageConversation[]>;
  getMessages: (peerId: string, beforeSentTime?: number) => Promise<MessageHistoryPage>;
  sendText: (peerId: string, text: string) => Promise<ManagedMessage>;
  sendImage: (peerId: string, path: string) => Promise<ManagedMessage>;
  downloadImage?: (message: ManagedMessage) => Promise<string>;
  sendAfterSaleCard?: (peerId: string, payload: AfterSaleCardPayload) => Promise<ManagedMessage>;
  markRead: (peerId: string) => Promise<boolean>;
  setConversationPinned?: (peerId: string, isPinned: boolean) => Promise<boolean>;
  subscribeConnectionStatus?: (listener: (signal: RongCloudConnectionSignal) => void) => () => void;
  subscribeConversationSync?: (listener: () => void) => () => void;
  // 其他设备上报"会话已读至某时间戳"后，服务端推送过来的同步通知
  subscribeReadSync?: (listener: (peerId: string, timestamp: number) => void) => () => void;
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
  conversationError: string | null;
  conversations: MessageConversation[];
  blacklistedUserIds: string[];
  messagesByPeerId: Record<string, ManagedMessage[]>;
  historyByPeerId: Record<string, HistoryState>;
  openPeerIds: string[];
  activePeerId: string | null;
  /** 聊天界面是否在前台可见；activePeerId 在页面被覆盖/退后台时仍保留，已读判断必须叠加此项 */
  chatForeground: boolean;
  /** 服务端返回的对端在线状态（按对端 id 存），与 conversations 解耦：会话壳可能还没进列表 */
  peerOnlineById: Record<string, boolean>;
  /** 诊断用：本次登录会话内确认为离线补偿重放的消息条数（隐藏弹窗展示，文案不含 SDK 厂商名） */
  compensatedCount: number;
  lastError: string | null;
  refreshOnlineStatuses: (token: string, peerId?: string) => Promise<boolean>;
  refreshConversations: (token: string) => Promise<void>;
  /** 兜底：进入消息页发现列表为空时，延迟重读一次快照（每次登录会话最多一次） */
  retryIfEmpty: (token: string) => Promise<void>;
  initialize: (token: string) => Promise<void>;
  setChatForeground: (visible: boolean) => void;
  openConversation: (conversation: Pick<MessageConversation, 'id' | 'title' | 'avatar' | 'clubId' | 'isCustomerService'>) => Promise<void>;
  closeConversation: (peerId?: string) => void;
  loadOlder: (peerId: string) => Promise<void>;
  sendText: (peerId: string, text: string) => Promise<void>;
  sendAfterSaleCard: (peerId: string, payload: import('@/features/order/after-sale-card').AfterSaleCardPayload) => Promise<boolean>;
  sendImage: (peerId: string, path: string) => Promise<void>;
  resolveImagePreview: (message: ManagedMessage) => Promise<string>;
  retryMessage: (peerId: string, clientId: string) => Promise<void>;
  markRead: (peerId: string) => Promise<void>;
  setConversationNote: (peerId: string, note: string) => void;
  setConversationPinned: (peerId: string, isPinned: boolean) => Promise<void>;
  clearAllUnread: () => Promise<void>;
  reset: () => Promise<void>;
};

const unavailableMessage = '当前版本暂不支持即时消息';
// 自动重连上限：达到后停止调度，避免连接不可用时无限请求 im/token。
const MAX_RECONNECT_ATTEMPTS = 10;
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

function toConversationShell(conversation: Pick<MessageConversation, 'id' | 'title' | 'avatar' | 'isCustomerService'>): MessageConversation {
  const id = normalizeSystemConversationId(conversation.id);
  return { ...conversation, id, title: getSystemConversationTitle(id, conversation.title), preview: '', time: '', unreadCount: 0, updatedAt: 0 };
}

function createAdapter(): MessageAdapter {
  return {
    available: isRongCloudAvailable,
    initialize: initializeRongCloud,
    isConnected: isRongCloudConnected,
    getConversations: getRongConversations,
    getMessages: getRongMessages,
    sendText: sendRongText,
    sendImage: sendRongImage,
    downloadImage: downloadRongImageMessage,
    sendAfterSaleCard: sendRongAfterSaleCard,
    markRead: markRongConversationRead,
    setConversationPinned: setRongConversationPinned,
    subscribeConnectionStatus: subscribeRongConnectionStatus,
    subscribeConversationSync: subscribeRongConversationSync,
    subscribeReadSync: subscribeRongConversationReadSync,
    subscribeConversations: subscribeRongMessages,
    subscribeMessages: subscribeRongMessageEvents,
    disconnect: disconnectRongCloud,
  };
}

export function createMessageStore(adapter: MessageAdapter): StoreApi<MessageStoreState> {
  let stopMessageSubscription: (() => void) | undefined;
  let stopBlacklistSubscription: (() => void) | undefined;
  let stopConnectionStatusSubscription: (() => void) | undefined;
  let stopConversationSyncSubscription: (() => void) | undefined;
  let stopReadSyncSubscription: (() => void) | undefined;
  let blacklistRevision = 0;
  let onlineStatusRequestId = 0;
  let onlineStatusToken: string | null = null;
  let hasInitialized = false;
  let initializeInProgress = false;
  let conversationSyncPending = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let reconnectAttempts = 0;
  let lifecycleRevision = 0;
  // 本次登录会话的就绪时间：离线补偿的历史消息（含已读）晚于它到达，但 sentAt 在它之前
  let sessionReadyAt = 0;
  // 空列表延迟重读的一次性闸门：避免每次聚焦消息页都重读（用户可能本来就 0 会话）
  let emptyListRetryUsed = false;
  // 允许少量设备间时钟误差，避免"刚好就绪时刻"的新消息被误判为补偿消息
  const BANNER_CLOCK_SKEW_MS = 5_000;

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
      const isActive = get().activePeerId === normalizedPeerId && get().chatForeground;
      const preview = messagePreview(message);
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
        receivedOffline: message.receivedOffline === true,
        sessionReadyAt,
      });
      if (
        !isSystemConversationId(normalizedPeerId)
        && get().blacklistedUserIds.includes(normalizedPeerId)
      ) {
        void adapter.markRead(normalizedPeerId).catch(() => undefined);
        return;
      }
      const normalizedConversation = { ...conversation, id: normalizedPeerId, title: normalizedConversationTitle };
      // 重装/换设备后的离线补偿会把窗口内的历史消息逐条重放（含已读的）。
      // 这些消息的未读状态以融云会话快照为准（服务端已保存已读态），
      // 这里不能再逐条 +1，否则已读消息会重新变成未读红点。
      // 就绪后迟到的 offline 消息（sentAt 晚于本次登录就绪时间）仍按新消息计数。
      const isReplayedHistory =
        message.receivedOffline === true
        && (sessionReadyAt === 0 || message.sentAt <= sessionReadyAt - BANNER_CLOCK_SKEW_MS);
      if (
        !isActive
        && !message.isMine
        && !isMessageNotificationMuted()
        // 重装/换设备登录后，离线补偿的历史消息（含其他设备已读的）分两批到达：
        // 一批在"连接后、会话就绪前"（此时 sessionReadyAt 还是 0），
        // 一批在就绪后但 sentAt 早于本次登录就绪时间。
        // 两类都只进列表（未读红点），不弹横幅
        && sessionReadyAt > 0
        && message.sentAt > sessionReadyAt - BANNER_CLOCK_SKEW_MS
      ) {
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
          preview: preview || normalizedConversation.preview,
          isOnline: message.isMine ? existing?.isOnline : true,
          unreadCount: isActive
            ? 0
            : message.isMine || isReplayedHistory
              ? (existing?.unreadCount || 0)
              : (existing?.unreadCount || 0) + 1,
          updatedAt: message.sentAt,
        };
        const conversations = isActive
          // 当前会话显式置 0；快照合并不降未读，不能整体走 mergeConversations。
          // 保留本地态字段（置顶/备注/客服身份等）：updated 为 undefined 时回退本地值。
          ? state.conversations.map((item) =>
              item.id === normalizedPeerId
                ? {
                    ...item,
                    ...Object.fromEntries(
                      Object.entries(nextConversation).filter(([, value]) => value !== undefined),
                    ),
                    unreadCount: 0,
                  }
                : item,
            )
          : mergeConversations(state.conversations, nextConversation);
        return {
          messagesByPeerId: state.openPeerIds.includes(normalizedPeerId)
            ? { ...state.messagesByPeerId, [normalizedPeerId]: mergeMessages(state.messagesByPeerId[normalizedPeerId] || [], message) }
            : state.messagesByPeerId,
          conversations,
          compensatedCount: isReplayedHistory ? state.compensatedCount + 1 : state.compensatedCount,
        };
      });
      if (isActive) void adapter.markRead(normalizedPeerId).catch((error) => set({ lastError: error instanceof Error ? error.message : '清除未读失败' }));
    };

    const updateLocalPreview = (peerId: string, message: ManagedMessage) => {
      const preview = messagePreview(message);
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
      let conversations: MessageConversation[];
      try {
        conversations = await adapter.getConversations();
      } catch (error) {
        if (expectedLifecycleRevision === lifecycleRevision) {
          set({ conversationError: error instanceof Error ? error.message : '消息列表加载失败，请重试' });
        }
        throw error;
      }
      if (expectedLifecycleRevision !== lifecycleRevision) return;
      const blockedUserIds = new Set(get().blacklistedUserIds);
      const unreadSnapshot = conversations
        .filter((conversation) => conversation.unreadCount > 0)
        .map((conversation) => ({ peerId: conversation.id, title: conversation.title, unread: conversation.unreadCount }));
      if (unreadSnapshot.length > 0) {
        logger.info('RongCloud conversation snapshot unread', {
          unread: JSON.stringify(unreadSnapshot),
        });
      }
      const blockedConversationIds = conversations
        .filter((conversation) =>
          !isSystemConversationId(conversation.id)
          && blockedUserIds.has(conversation.id),
        )
        .map((conversation) => conversation.id);
      set((state) => ({
        conversationError: null,
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
      if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        logger.warn('RongCloud auto reconnect attempts exhausted', {
          stage: 'reconnect-schedule',
          attempts: reconnectAttempts,
        });
        return;
      }
      const delayMs = Math.min(1_000 * 2 ** Math.min(reconnectAttempts, 5), 30_000);
      reconnectAttempts += 1;
      logger.info('RongCloud auto reconnect scheduled', {
        stage: 'reconnect-schedule',
        attempt: reconnectAttempts,
        delayMs,
      });
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
          // 连接失败且已达上限时重置 attempts，让用户点重试/下次进入时重新计数。
          set({ connectionState: 'error', lastError: '即时消息连接超时，正在自动重连' });
          if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            logger.warn('RongCloud reconnect limit reached after timeout', {
              stage: 'reconnect-timeout',
              attempts: reconnectAttempts,
            });
            return;
          }
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
      conversationError: null,
      conversations: [],
      blacklistedUserIds: [],
      messagesByPeerId: {},
      historyByPeerId: {},
      openPeerIds: [],
      activePeerId: null,
      chatForeground: false,
      peerOnlineById: {},
      compensatedCount: 0,
      lastError: null,

      refreshOnlineStatuses: async (token, peerId) => {
        const requestId = ++onlineStatusRequestId;
        if (!token) return false;
        // 传入 peerId 时只查该对端（聊天页轮询），否则查全部真实会话（消息列表轮询）
        const scopedId = peerId ? normalizeSystemConversationId(peerId) : null;
        const userIds = scopedId
          ? [scopedId]
          : Array.from(new Set(
              get().conversations
                .filter((conversation) => !isSystemConversationId(conversation.id))
                .map((conversation) => normalizeSystemConversationId(conversation.id))
                .filter(Boolean),
            ));

        try {
          const statuses: Record<string, number> = userIds.length > 0
            ? await clientAuthApi.getUserOnlineStatus(token, userIds)
            : {};
          // 被更新请求顶替不算失败，避免轮询误判进入退避
          if (requestId !== onlineStatusRequestId) return true;
          const requestedIds = new Set(userIds);
          set((state) => {
            // 按对端记录状态：会话壳可能还没进 conversations（如从主页直接发起私聊），
            // 聊天页头部据此展示在线态，不依赖会话行是否存在
            const peerOnlineById = { ...state.peerOnlineById };
            let statusesChanged = false;
            userIds.forEach((id) => {
              const isOnline = Number(statuses[id]) === 1;
              if (peerOnlineById[id] !== isOnline) {
                peerOnlineById[id] = isOnline;
                statusesChanged = true;
              }
            });
            let changed = false;
            const conversations = state.conversations.map((conversation) => {
              if (scopedId) {
                // 作用域模式只更新目标会话，不动系统会话与其它会话的在线态
                if (conversation.id !== scopedId) {
                  return conversation;
                }
                const isOnline = Number(statuses[conversation.id]) === 1;
                if (Boolean(conversation.isOnline) === isOnline) {
                  return conversation;
                }
                changed = true;
                return { ...conversation, isOnline };
              }
              if (isSystemConversationId(conversation.id)) {
                if (!conversation.isOnline) {
                  return conversation;
                }
                changed = true;
                return { ...conversation, isOnline: false };
              }
              if (!requestedIds.has(conversation.id)) {
                return conversation;
              }
              const isOnline = Number(statuses[conversation.id]) === 1;
              // 状态未变化时复用原对象，避免轮询每 5 秒击穿列表项 memo
              if (Boolean(conversation.isOnline) === isOnline) {
                return conversation;
              }
              changed = true;
              return { ...conversation, isOnline };
            });
            if (!changed && !statusesChanged) return state;
            return {
              peerOnlineById,
              ...(changed ? { conversations } : {}),
            };
          });
          return true;
        } catch {
          // 失败保留旧快照，由调用方按自己的节奏重试
          return false;
        }
      },

      refreshConversations: async (token) => {
        if (!token) return;
        onlineStatusToken = token;
        // 标记 ready 且长连接实际在线才直接同步；后台挂起等假 ready 场景需走 initialize 重连
        if (get().connectionState === 'ready' && adapter.isConnected?.() === true) {
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

      retryIfEmpty: async (token) => {
        if (!token) return;
        if (emptyListRetryUsed) return;
        if (get().connectionState !== 'ready') return;
        if (get().conversations.length > 0) return;
        // reset 的异步断开窗口内 connectionState 仍是 ready，但会话已失效——拒绝旧 token 的重试
        if (onlineStatusToken !== token) return;
        emptyListRetryUsed = true;
        logger.info('Retrying empty conversation snapshot', {
          stage: 'empty-list-retry',
          connectionState: get().connectionState,
        });
        try {
          await syncConversations(lifecycleRevision);
        } catch (error) {
          logger.warn('Empty conversation snapshot retry failed', {
            stage: 'empty-list-retry',
            errorName: error instanceof Error ? error.name : typeof error,
          });
        }
      },

      initialize: async (token) => {
        // 同步闸门：在任何 await 之前先占位，避免 useEffect / 多个调用方重入。
        // 否则在 await readBlacklist 期间,RootLayout 的 effect 可能再次触发 initialize,
        // 形成 initialize → set('connecting') → React 重渲染 → effect 重跑 → initialize 的死循环。
        if (initializeInProgress) return;
        // 状态标记为已连接、且 SDK 长连接实际在线时才跳过；
        // 后台挂起/互踢等场景下 connectionState 仍是 ready 但连接已断，必须允许重连
        if ((get().connectionState === 'connecting' || get().connectionState === 'ready')
          && adapter.isConnected?.() === true) return;
        if (!token) return;
        if (!adapter.available()) {
          set({ connectionState: 'unavailable', lastError: unavailableMessage });
          return;
        }

        const initializationRevision = lifecycleRevision;
        onlineStatusToken = token || null;
        initializeInProgress = true;
        conversationSyncPending = false;
        set({ connectionState: 'connecting', lastError: null });
        logger.info('RongCloud initialize starting', {
          stage: 'message-store-initialize',
          attempt: reconnectAttempts,
        });

        ensureNotificationSettingsLoaded().catch(() => undefined);
        if (!stopBlacklistSubscription) {
          stopBlacklistSubscription = subscribeBlacklist((entries) => {
            blacklistRevision += 1;
            applyBlacklist(entries);
          });
        }
        const revision = blacklistRevision;
        let entries: BlacklistEntry[] = [];
        try {
          entries = await readBlacklist();
        } catch {
          initializeInProgress = false;
          set({ connectionState: 'error', lastError: '即时消息初始化失败，请稍后重试' });
          return;
        }
        if (initializationRevision !== lifecycleRevision) {
          initializeInProgress = false;
          return;
        }
        if (revision === blacklistRevision) applyBlacklist(entries);
        watchConnectionStatus();
        if (!stopMessageSubscription) stopMessageSubscription = adapter.subscribeMessages(receiveMessage);
        if (!stopConversationSyncSubscription) {
          stopConversationSyncSubscription = adapter.subscribeConversationSync?.(() => {
            if (initializeInProgress) {
              conversationSyncPending = true;
              return;
            }
            if (get().connectionState !== 'ready') return;
            void syncConversations(lifecycleRevision).catch((error) => {
              logger.warn('Message conversation synchronization failed', {
                errorName: error instanceof Error ? error.name : typeof error,
              });
            });
          });
        }
        if (!stopReadSyncSubscription) {
          stopReadSyncSubscription = adapter.subscribeReadSync?.((peerId) => {
            set((state) => ({
              conversations: state.conversations.map((item) => item.id === peerId ? { ...item, unreadCount: 0 } : item),
            }));
          });
        }
        set({ connectionState: 'connecting', lastError: null });
        try {
          const ready = await adapter.initialize(token);
          if (initializationRevision !== lifecycleRevision) {
            initializeInProgress = false;
            return;
          }
          if (!ready) {
            initializeInProgress = false;
            logger.warn('Instant messaging adapter initialization returned false', {
              stage: 'adapter-initialize',
              attempt: reconnectAttempts,
            });
            set({ connectionState: 'error', lastError: '即时消息连接失败，请稍后重试' });
            return;
          }
          // List restoration can fail while the IM connection remains usable.
          // Keep live messaging available and expose the list error separately.
          await syncConversations(initializationRevision).catch(() => undefined);
          if (initializationRevision !== lifecycleRevision) {
            initializeInProgress = false;
            return;
          }
          if (conversationSyncPending) {
            // Offline messages can finish syncing after the first read started.
            conversationSyncPending = false;
            await syncConversations(initializationRevision).catch(() => undefined);
            if (initializationRevision !== lifecycleRevision) {
              initializeInProgress = false;
              return;
            }
          }
          hasInitialized = true;
          initializeInProgress = false;
          sessionReadyAt = Date.now();
          set({ connectionState: 'ready', lastError: null });
          // 离线同步完成事件若恰好在上面最后一次同步执行期间到达，会被
          // subscribeConversationSync 回调标记 pending 但无人消费——这里兜底再读一次快照。
          if (conversationSyncPending) {
            conversationSyncPending = false;
            void syncConversations(initializationRevision).catch(() => undefined);
          }
        } catch (error) {
          if (initializationRevision !== lifecycleRevision) {
            initializeInProgress = false;
            return;
          }
          initializeInProgress = false;
          logger.warn('Instant messaging initialization threw an error', {
            stage: 'message-store-initialize',
            attempt: reconnectAttempts,
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
            chatForeground: true,
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
        set({
          activePeerId,
          openPeerIds,
          messagesByPeerId,
          historyByPeerId,
          chatForeground: activePeerId ? state.chatForeground : false,
        });
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

      resolveImagePreview: async (message) => {
        if (message.kind !== 'image') throw new Error('消息不是图片');
        // 只返回预览地址，不覆写气泡的 imageUrl：把气泡换成下载好的本地原图
        // 会让返回聊天后多张大图同时重新解码，滚动直接卡顿
        const imageUrl = adapter.downloadImage
          ? await adapter.downloadImage(message)
          : message.imageUrl;
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
        if (get().connectionState !== 'ready') {
          // 静默吞掉已读上报会导致服务端永远不知道已读，重装后未读会复活——必须留痕
          logger.warn('markRead skipped while IM not ready', { peerId, connectionState: get().connectionState });
          return;
        }
        try { await adapter.markRead(peerId); } catch (error) { set({ lastError: error instanceof Error ? error.message : '清除未读失败' }); }
      },

      setConversationNote: (peerId, note) => set((state) => ({
        conversations: state.conversations.map((conversation) => conversation.id === peerId ? { ...conversation, note } : conversation),
      })),

      setChatForeground: (visible) => set({ chatForeground: visible }),

      setConversationPinned: async (peerId, isPinned) => {
        const previous = get().conversations.find((item) => item.id === peerId)?.isPinned ?? false;
        const applyPinned = (value: boolean) => set((state) => ({
          conversations: state.conversations
            .map((conversation) => conversation.id === peerId ? { ...conversation, isPinned: value } : conversation)
            .sort((left, right) => Number(Boolean(right.isPinned)) - Number(Boolean(left.isPinned)) || right.updatedAt - left.updatedAt),
        }));
        // 先本地生效保证交互即时，再写回融云服务端实现多端同步。
        applyPinned(isPinned);
        if (get().connectionState !== 'ready') return;
        const pinConversation = adapter.setConversationPinned;
        if (!pinConversation) return;
        try {
          await pinConversation(peerId, isPinned);
        } catch (error) {
          applyPinned(previous);
          set({ lastError: error instanceof Error ? error.message : '设置置顶失败' });
        }
      },

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
        conversationSyncPending = false;
        reconnectAttempts = 0;
        sessionReadyAt = 0;
        emptyListRetryUsed = false;
        clearCsInviteClaimStates();
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = undefined;
        stopMessageSubscription?.();
        stopBlacklistSubscription?.();
        stopConnectionStatusSubscription?.();
        stopConversationSyncSubscription?.();
        stopReadSyncSubscription?.();
        stopMessageSubscription = undefined;
        stopBlacklistSubscription = undefined;
        stopConnectionStatusSubscription = undefined;
        stopConversationSyncSubscription = undefined;
        stopReadSyncSubscription = undefined;
        await adapter.disconnect();
        set({ connectionState: 'idle', conversationError: null, conversations: [], blacklistedUserIds: [], messagesByPeerId: {}, historyByPeerId: {}, openPeerIds: [], activePeerId: null, chatForeground: false, peerOnlineById: {}, compensatedCount: 0, lastError: null });
      },
    };
  });

  return store;
}

export const messageStore = createMessageStore(createAdapter());

export function useMessageStore<T>(selector: (state: MessageStoreState) => T) {
  return useStore(messageStore, selector);
}
