import type {
  RCIMIWChatRoomMemberBlockEvent,
  RCIMIWConversation,
  RCIMIWEngine,
  RCIMIWMediaMessage,
  RCIMIWMessage,
} from '@rongcloud/react-native-im-wrapper';

import { ApiError } from '@/core/network/api-client';
import { logger } from '@/core/logging/logger';
import { mapRongMessage, messagePreview, type RongSdkMessage } from './chat-message';
import type { ManagedMessage, MessageConversation, MessageHistoryPage } from './message-state';
import type { AfterSaleCardPayload } from '@/features/order/after-sale-card';
import { getRongConversationTargetId, getSystemConversationTitle, isSystemConversationId, normalizeSystemConversationId } from './system-conversations';
import { loadConversationSnapshot } from './conversation-loader';
import { parseRongCommand, type RongCommand } from './rongcloud-command';
import { KNOWN_RONG_COMMAND_NAMES } from './rongcloud-commands';

export type RongConversation = MessageConversation;
export type RongTextMessage = ManagedMessage;

type RongSdk = typeof import('@rongcloud/react-native-im-wrapper');
type ConversationListener = (conversation: RongConversation) => void;
type MessageListener = (peerId: string, message: ManagedMessage, conversation: RongConversation) => void;
type ChatRoomMessageListener = (roomId: string, message: RCIMIWMessage) => void;
type ChatRoomMemberListener = (roomId: string, actions: { userId?: string; actionType?: number }[]) => void;
export type RongCloudConnectionSignal = 'connected' | 'connecting' | 'timeout' | 'terminal';

let engine: RCIMIWEngine | null = null;
let connected = false;
let businessToken = '';
let hasStartedConnection = false;
let connectionAttempt: Promise<boolean> | null = null;
let cancelConnectionAttempt: (() => void) | null = null;
let connectionEpoch = 0;
const conversationListeners = new Set<ConversationListener>();
const conversationSyncListeners = new Set<() => void>();
const conversationReadSyncListeners = new Set<(peerId: string, timestamp: number) => void>();
const messageListeners = new Set<MessageListener>();
const connectionStatusListeners = new Set<(signal: RongCloudConnectionSignal) => void>();
const chatRoomMessageListeners = new Set<ChatRoomMessageListener>();
const chatRoomMemberListeners = new Set<ChatRoomMemberListener>();
const commandListeners = new Set<(command: RongCommand) => void>();
const chatRoomBlockedListeners = new Set<(event: RCIMIWChatRoomMemberBlockEvent) => void>();

function getRuntimeConfig() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('../../core/config/env') as typeof import('../../core/config/env');
  } catch {
    return { env: { rongCloudAppKey: '' } };
  }
}

function getClientAuthApi() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('../auth/client-auth.api').clientAuthApi as typeof import('../auth/client-auth.api').clientAuthApi;
}

function loadSdk(): RongSdk | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@rongcloud/react-native-im-wrapper') as RongSdk;
  } catch {
    return null;
  }
}

function getSdkEnums() {
  const sdk = loadSdk();
  return sdk ? {
    conversationType: sdk.RCIMIWConversationType.PRIVATE,
    imageType: sdk.RCIMIWMessageType.IMAGE,
    directionSend: sdk.RCIMIWMessageDirection.SEND,
    timeBefore: sdk.RCIMIWTimeOrder.BEFORE,
    localRemote: sdk.RCIMIWMessageOperationPolicy.LOCAL_REMOTE,
  } : null;
}

function mapPreview(message?: RCIMIWMessage) {
  const enums = getSdkEnums();
  const time = message?.sentTime ? new Date(message.sentTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '';
  const mapped = message && enums
    ? mapRongMessage(message as RongSdkMessage, { image: enums.imageType, send: enums.directionSend })
    : null;
  if (mapped) return { preview: messagePreview(mapped), time };
  const content = message as (RCIMIWMessage & { text?: string; content?: string }) | undefined;
  const text = content?.text || content?.content;
  return { preview: text || '新消息', time };
}

function mapConversation(conversation: RCIMIWConversation): RongConversation {
  const id = normalizeSystemConversationId(String(conversation.targetId || ''));
  const last = mapPreview(conversation.lastMessage);
  return {
    id,
    title: getSystemConversationTitle(id, String(conversation.targetId || '消息')),
    preview: last.preview,
    time: last.time,
    unreadCount: conversation.unreadCount || 0,
    updatedAt: conversation.lastMessage?.sentTime || 0,
    // 与 Web 端一致：置顶态以融云服务端的 top 为准（多端同步）；
    // 快照未携带该字段时保持 undefined，交由 mergeConversations 保留本地态。
    isPinned: conversation.top == null ? undefined : Boolean(conversation.top),
  };
}

async function hydrateConversation(conversation: RongConversation) {
  if (!businessToken || !conversation.id) return conversation;
  if (isSystemConversationId(conversation.id)) {
    return { ...conversation, title: getSystemConversationTitle(conversation.id), avatar: undefined };
  }
  try {
    const profile = await getClientAuthApi().getUserProfile(businessToken, conversation.id);
    return { ...conversation, title: profile.nickname || conversation.title, avatar: profile.headImage || undefined };
  } catch {
    return conversation;
  }
}

export function isRongCloudAvailable() {
  let nativeModules: { RCReactNativeIM?: unknown } = {};
  let platform = 'web';
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const reactNative = require('react-native') as { NativeModules?: typeof nativeModules; Platform?: { OS?: string } };
    nativeModules = reactNative.NativeModules || {};
    platform = reactNative.Platform?.OS || platform;
  } catch (error) {
    logger.warn('Could not inspect native module availability', {
      stage: 'availability',
      errorName: error instanceof Error ? error.name : typeof error,
    });
    return false;
  }
  const turboModuleEnabled = Boolean((globalThis as typeof globalThis & { __turboModuleProxy?: unknown }).__turboModuleProxy);
  const { env } = getRuntimeConfig();
  const hasAppKey = Boolean(env.rongCloudAppKey);
  const hasNativeModule = Boolean(nativeModules.RCReactNativeIM);
  const available = platform !== 'web' && hasAppKey && (hasNativeModule || turboModuleEnabled);
  if (!available) {
    logger.warn('RongCloud is unavailable in this runtime', {
      stage: 'availability',
      platform,
      hasAppKey,
      hasNativeModule,
      turboModuleEnabled,
    });
  }
  return available;
}

export function toManagedMessage(message: RongSdkMessage | RCIMIWMessage, messageEnums = getSdkEnums()): ManagedMessage | null {
  if (!messageEnums) return null;
  const mapped = mapRongMessage(message as RongSdkMessage, { image: messageEnums.imageType, send: messageEnums.directionSend });
  if (!mapped) return null;
  return {
    ...mapped,
    ...(mapped.kind === 'image' ? { mediaSource: message as RCIMIWMediaMessage } : {}),
    status: 'sent',
    sentAt: message.sentTime || Date.now(),
  };
}

function toLocalMediaUri(path: string) {
  if (/^(?:file|content):\/\//i.test(path)) return path;
  return `file://${path.startsWith('/') ? '' : '/'}${path}`;
}

export async function downloadRongImageMessage(message: ManagedMessage): Promise<string> {
  if (message.kind !== 'image') throw new Error('消息不是图片');
  if (/^(?:file|content):\/\//i.test(message.imageUrl)) return message.imageUrl;
  const mediaMessage = message.mediaSource as RCIMIWMediaMessage | undefined;
  if (!mediaMessage) {
    if (/^https?:\/\/[^/]*ronghub\.com\//i.test(message.imageUrl)) {
      throw new Error('缺少融云媒体消息数据，无法通过 SDK 下载图片');
    }
    return message.imageUrl;
  }
  if (mediaMessage.local) return toLocalMediaUri(mediaMessage.local);

  const currentEngine = requireConnected();
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error, localPath?: string) => {
      if (settled) return;
      settled = true;
      if (error) {
        reject(error);
        return;
      }
      if (!localPath) {
        reject(new Error('融云图片下载完成，但没有返回本地文件路径'));
        return;
      }
      resolve(toLocalMediaUri(localPath));
    };

    void currentEngine.downloadMediaMessage(mediaMessage, {
      onMediaMessageDownloaded: (code, downloadedMessage) => {
        if (code !== 0) {
          finish(new Error(`融云图片下载失败（${code}）`));
          return;
        }
        finish(undefined, downloadedMessage.local);
      },
    }).then((code) => {
      if (code !== 0) finish(new Error(`融云图片下载请求失败（${code}）`));
    }).catch((error: unknown) => {
      finish(error instanceof Error ? error : new Error('融云图片下载请求失败'));
    });
  });
}

function emitConversation(conversation: RongConversation) {
  conversationListeners.forEach((listener) => listener(conversation));
}

function publishConnectionStatus(status: number): RongCloudConnectionSignal {
  const sdk = loadSdk();
  const statuses = sdk?.RCIMIWConnectionStatus;
  const signal: RongCloudConnectionSignal = status === statuses?.CONNECTED
    ? 'connected'
    : status === statuses?.TIMEOUT
      ? 'timeout'
      : status === statuses?.TOKEN_INCORRECT
        || status === statuses?.CONN_USER_BLOCKED
        || status === statuses?.KICKED_OFFLINE_BY_OTHER_CLIENT
        || status === statuses?.SIGN_OUT
        ? 'terminal'
        : 'connecting';
  connected = signal === 'connected';
  connectionStatusListeners.forEach((listener) => listener(signal));
  return signal;
}

function publishConnectionSignal(signal: RongCloudConnectionSignal) {
  connected = signal === 'connected';
  connectionStatusListeners.forEach((listener) => listener(signal));
}

export function subscribeRongConnectionStatus(
  listener: (signal: RongCloudConnectionSignal) => void,
) {
  connectionStatusListeners.add(listener);
  return () => connectionStatusListeners.delete(listener);
}

function waitForRongCloudConnection(currentEngine: RCIMIWEngine) {
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      stopListening();
      if (cancelConnectionAttempt === cancel) cancelConnectionAttempt = null;
      resolve(value);
    };
    const onStatus = (signal: RongCloudConnectionSignal) => {
      if (signal === 'connected') finish(true);
      else if (signal === 'terminal' || signal === 'timeout') finish(false);
    };
    const stopListening = subscribeRongConnectionStatus(onStatus);
    const cancel = () => finish(false);
    cancelConnectionAttempt = cancel;
    void currentEngine.getConnectionStatus()
      .then((status) => publishConnectionStatus(status))
      .catch(() => undefined);
  });
}

function waitBeforeConnectionRetry(delayMs: number, attemptEpoch: number) {
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (shouldContinue: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (cancelConnectionAttempt === cancel) cancelConnectionAttempt = null;
      resolve(shouldContinue && attemptEpoch === connectionEpoch);
    };
    const cancel = () => finish(false);
    const timer = setTimeout(() => finish(true), delayMs);
    cancelConnectionAttempt = cancel;
  });
}

function isTransientImTokenError(error: unknown): error is ApiError {
  if (!(error instanceof ApiError)) return false;
  return error.status === 0
    || error.status === 408
    || error.status === 429
    || error.status >= 500;
}

async function fetchImTokenWithRetry(accessToken: string, attemptEpoch: number) {
  let retryCount = 0;
  while (attemptEpoch === connectionEpoch) {
    try {
      return await getClientAuthApi().getImToken(accessToken);
    } catch (error) {
      if (!isTransientImTokenError(error) || attemptEpoch !== connectionEpoch) throw error;
      const delayMs = Math.min(1_000 * 2 ** Math.min(retryCount, 5), 30_000);
      retryCount += 1;
      logger.warn('IM token request failed temporarily; retrying', {
        stage: 'im-token',
        attempt: retryCount,
        retryInMs: delayMs,
        status: error.status,
      });
      const shouldRetry = await waitBeforeConnectionRetry(delayMs, attemptEpoch);
      if (!shouldRetry) return null;
    }
  }
  return null;
}

async function emitReceived(message: RCIMIWMessage) {
  const enums = getSdkEnums();
  const peerId = normalizeSystemConversationId(message.senderUserId || message.targetId || '');
  if (!enums || message.conversationType !== enums.conversationType || !peerId) return;
  const mapped = toManagedMessage(message);
  if (!mapped) return;
  const conversation = await hydrateConversation(mapConversation({
    targetId: getRongConversationTargetId(peerId),
    conversationType: message.conversationType,
    lastMessage: message,
    unreadCount: 1,
  } as RCIMIWConversation));
  emitConversation(conversation);
  messageListeners.forEach((listener) => listener(peerId, mapped, conversation));
}

function installListeners() {
  if (!engine) return;
  engine.setOnOfflineMessageSyncCompletedListener(() => {
    conversationSyncListeners.forEach((listener) => listener());
  });
  engine.setOnMessageReceivedListener((message) => {
    const sdk = loadSdk();
    if (sdk && message.messageType === sdk.RCIMIWMessageType.COMMAND) {
      const command = parseRongCommand(message, {
        private: sdk.RCIMIWConversationType.PRIVATE,
        command: sdk.RCIMIWMessageType.COMMAND,
      });
      if (command) {
        if (!KNOWN_RONG_COMMAND_NAMES.has(command.name)) {
          logger.warn('Unknown RongCloud command received', {
            name: command.name,
            senderId: command.senderId,
          });
        }
        commandListeners.forEach((listener) => listener(command));
      }
      return;
    }
    if (sdk && message.conversationType === sdk.RCIMIWConversationType.CHATROOM) {
      const roomId = String(message.targetId || '');
      chatRoomMessageListeners.forEach((listener) => listener(roomId, message));
      return;
    }
    void emitReceived(message);
  });
  engine.setOnChatRoomMemberChangedListener((roomId, actions) => {
    chatRoomMemberListeners.forEach((listener) => listener(roomId, actions));
  });
  engine.setOnChatRoomNotifyBlockListener((event) => {
    const sdk = loadSdk();
    if (sdk && event.operateType === sdk.RCIMIWChatRoomMemberOperateType.Blocked) {
      chatRoomBlockedListeners.forEach((listener) => listener(event));
    }
  });
  engine.setOnConversationReadStatusSyncMessageReceivedListener((type, targetId, timestamp) => {
    const sdk = loadSdk();
    const currentEngine = engine;
    if (!sdk || !targetId || type !== sdk.RCIMIWConversationType.PRIVATE || !currentEngine) return;
    // SDK 不会自动清本机未读，这里同步清掉，避免下次从快照加载又冒出来
    void currentEngine.clearUnreadCount(type, targetId, '', timestamp).catch(() => undefined);
    const peerId = normalizeSystemConversationId(targetId);
    conversationReadSyncListeners.forEach((listener) => listener(peerId, timestamp));
  });
  engine.setOnConnectionStatusChangedListener((status) => {
    publishConnectionStatus(status);
  });
}

export function getRongCloudEngine() {
  return engine;
}

export function subscribeRongCommands(listener: (command: RongCommand) => void) {
  commandListeners.add(listener);
  return () => { commandListeners.delete(listener); };
}

export function subscribeRongChatRoomBlocked(listener: (event: RCIMIWChatRoomMemberBlockEvent) => void) {
  chatRoomBlockedListeners.add(listener);
  return () => { chatRoomBlockedListeners.delete(listener); };
}

export function subscribeRongChatRoomMessages(listener: ChatRoomMessageListener) {
  chatRoomMessageListeners.add(listener);
  return () => chatRoomMessageListeners.delete(listener);
}

export function subscribeRongChatRoomMembers(listener: ChatRoomMemberListener) {
  chatRoomMemberListeners.add(listener);
  return () => chatRoomMemberListeners.delete(listener);
}

export function isRongCloudConnected() {
  return connected;
}

export function connectRongCloud(accessToken: string) {
  if (connectionAttempt) return connectionAttempt;
  const attemptEpoch = connectionEpoch;
  logger.info('RongCloud connectRongCloud invoked', {
    stage: 'connect-invoked',
    hasEngine: Boolean(engine),
    hasStartedConnection,
  });
  const attempt = connectRongCloudOnce(accessToken, attemptEpoch).finally(() => {
    if (connectionAttempt === attempt) connectionAttempt = null;
  });
  connectionAttempt = attempt;
  return attempt;
}

async function connectRongCloudOnce(accessToken: string, attemptEpoch: number) {
  let stage = 'availability';
  try {
    if (attemptEpoch !== connectionEpoch) return false;
    if (!isRongCloudAvailable()) return false;
    if (!accessToken) {
      logger.warn('RongCloud connection skipped without an access token', { stage: 'access-token' });
      return false;
    }
    businessToken = accessToken;
    if (!engine) {
      stage = 'sdk-load';
      const sdk = loadSdk();
      if (!sdk) {
        logger.warn('RongCloud SDK could not be loaded', { stage });
        return false;
      }
      stage = 'engine-init';
      const { env } = getRuntimeConfig();
      engine = sdk.RCIMIWEngine.create(env.rongCloudAppKey);
      // Server notifications use this envelope; ORDER_NOTIFY is its name field.
      await engine.registerNativeCustomMessage(
        'RC:CustomMsg',
        sdk.RCIMIWNativeCustomMessagePersistentFlag.Counted,
      );
      await engine.registerNativeCustomMessage(
        'ORDER_NOTIFY',
        sdk.RCIMIWNativeCustomMessagePersistentFlag.Counted,
      );
      await engine.registerNativeCustomMessage(
        'PZAfterSaleApply',
        sdk.RCIMIWNativeCustomMessagePersistentFlag.Counted,
      );
      installListeners();
      if (attemptEpoch !== connectionEpoch) return false;
    }
    const currentEngine = engine;
    const sdk = loadSdk();
    if (!currentEngine || !sdk) return false;

    const currentStatus = await currentEngine.getConnectionStatus().catch(() => undefined);
    if (attemptEpoch !== connectionEpoch) return false;
    if (typeof currentStatus === 'number') {
      const signal = publishConnectionStatus(currentStatus);
      if (signal === 'connected') return true;
      const statuses = sdk.RCIMIWConnectionStatus;
      const sdkIsReconnecting = currentStatus === statuses.CONNECTING
        || currentStatus === statuses.SUSPEND
        || currentStatus === statuses.NETWORK_UNAVAILABLE;
      if (hasStartedConnection && sdkIsReconnecting) {
        logger.info('RongCloud SDK is already reconnecting', { stage: 'connection-status' });
        return waitForRongCloudConnection(currentEngine);
      }
    }

    stage = 'im-token';
    logger.info('RongCloud fetching IM token', { stage });
    const tokenResponse = await fetchImTokenWithRetry(accessToken, attemptEpoch);
    if (attemptEpoch !== connectionEpoch) return false;
    const token = tokenResponse?.token;
    if (!token) {
      logger.warn('RongCloud IM token response did not contain a token', { stage });
      return false;
    }
    stage = 'connect';
    logger.info('RongCloud invoking engine.connect', {
      stage,
      hasExistingConnection: hasStartedConnection,
    });
    hasStartedConnection = true;
    return await new Promise<boolean>((resolve) => {
      let settled = false;
      let loggedExistingConnection = false;
      const finish = (value: boolean) => {
        if (settled) return;
        settled = true;
        stopListening();
        if (cancelConnectionAttempt === cancel) cancelConnectionAttempt = null;
        if (value) connected = true;
        resolve(value);
      };
      const onStatus = (signal: RongCloudConnectionSignal) => {
        if (signal === 'connected') finish(true);
        else if (signal === 'terminal' || signal === 'timeout') finish(false);
      };
      const stopListening = subscribeRongConnectionStatus(onStatus);
      const cancel = () => finish(false);
      cancelConnectionAttempt = cancel;
      const inspectStatus = () => {
        void currentEngine.getConnectionStatus()
          .then((status) => publishConnectionStatus(status))
          .catch(() => undefined);
      };
      const handleConnectResult = (code: number, resultStage: string) => {
        if (attemptEpoch !== connectionEpoch) return;
        if (code === 0) {
          finish(true);
          return;
        }
        if (code === 34001) {
          if (!loggedExistingConnection) {
            logger.info('RongCloud connection already exists or is reconnecting', {
              stage: resultStage,
              errorCode: code,
            });
            loggedExistingConnection = true;
          }
          inspectStatus();
          return;
        }
        if (code === 34006) {
          logger.warn('RongCloud connection timed out; scheduling another attempt', {
            stage: resultStage,
            errorCode: code,
          });
          publishConnectionSignal('timeout');
          finish(false);
          return;
        }
        logger.warn('RongCloud connection failed', { stage: resultStage, errorCode: code });
        finish(false);
      };

      void currentEngine.connect(token, 0, {
        onConnected: (code) => {
          handleConnectResult(code, 'connect-callback');
        },
      }).then((code) => {
        if (code !== 0) handleConnectResult(code, 'connect-result');
      }).catch((error: unknown) => {
        logger.warn('RongCloud connect call rejected', {
          stage: 'connect-rejected',
          errorName: error instanceof Error ? error.name : typeof error,
        });
        finish(false);
      });
    });
  } catch (error) {
    if (attemptEpoch !== connectionEpoch) return false;
    connected = false;
    logger.warn('RongCloud initialization failed', {
      stage,
      errorName: error instanceof Error ? error.name : typeof error,
    });
    return false;
  }
}

export async function initializeRongCloud(accessToken: string) {
  return connectRongCloud(accessToken);
}

export async function getRongConversations(): Promise<RongConversation[]> {
  const sdk = loadSdk();
  if (!engine || !connected || !sdk) throw new Error('即时消息尚未连接，请稍后重试');
  const epoch = connectionEpoch;
  const conversations = await loadConversationSnapshot(engine, sdk.RCIMIWConversationType.PRIVATE);
  if (epoch !== connectionEpoch) return [];
  return Promise.all(conversations.map(mapConversation).filter((item) => item.id).map(hydrateConversation));
}

export function subscribeRongConversationSync(listener: () => void) {
  conversationSyncListeners.add(listener);
  return () => conversationSyncListeners.delete(listener);
}

export function subscribeRongConversationReadSync(listener: (peerId: string, timestamp: number) => void) {
  conversationReadSyncListeners.add(listener);
  return () => conversationReadSyncListeners.delete(listener);
}

export function subscribeRongMessages(onMessage: ConversationListener) {
  conversationListeners.add(onMessage);
  return () => conversationListeners.delete(onMessage);
}

export function subscribeRongConversationMessages(targetId: string, onMessage: (message: ManagedMessage) => void) {
  const normalizedTargetId = normalizeSystemConversationId(targetId);
  const listener: MessageListener = (peerId, message) => { if (normalizeSystemConversationId(peerId) === normalizedTargetId) onMessage(message); };
  messageListeners.add(listener);
  return () => messageListeners.delete(listener);
}

export function subscribeRongMessageEvents(onMessage: MessageListener) {
  messageListeners.add(onMessage);
  return () => messageListeners.delete(onMessage);
}

export async function getRongMessages(targetId: string, beforeSentTime?: number): Promise<MessageHistoryPage> {
  const sdk = loadSdk();
  if (!engine || !connected || !sdk || !targetId) return { messages: [], nextCursor: null, hasMore: false };
  const count = 20;
  return new Promise((resolve) => {
    let settled = false;
    const finish = (page: MessageHistoryPage) => { if (!settled) { settled = true; resolve(page); } };
    void engine?.getMessages(
      sdk.RCIMIWConversationType.PRIVATE,
      getRongConversationTargetId(targetId),
      '',
      beforeSentTime || 0,
      sdk.RCIMIWTimeOrder.BEFORE,
      sdk.RCIMIWMessageOperationPolicy.LOCAL_REMOTE,
      count,
      {
        onSuccess: (messages) => {
          const mapped = (messages || []).map((message) => toManagedMessage(message)).filter((message): message is ManagedMessage => Boolean(message));
          const chronological = mapped.sort((left, right) => left.sentAt - right.sentAt);
          const oldest = chronological[0]?.sentAt || null;
          finish({ messages: chronological, nextCursor: chronological.length === count ? oldest : null, hasMore: chronological.length === count });
        },
        onError: () => finish({ messages: [], nextCursor: null, hasMore: false }),
      },
    ).then((code) => { if (code !== 0) finish({ messages: [], nextCursor: null, hasMore: false }); }).catch(() => finish({ messages: [], nextCursor: null, hasMore: false }));
  });
}

function requireConnected() {
  if (!engine || !connected) throw new Error('融云尚未连接');
  return engine;
}

export async function sendRongText(targetId: string, text: string): Promise<ManagedMessage> {
  const sdk = loadSdk();
  if (!sdk) throw new Error('当前版本暂不支持即时消息');
  const currentEngine = requireConnected();
  const message = await currentEngine.createTextMessage(sdk.RCIMIWConversationType.PRIVATE, getRongConversationTargetId(targetId), '', text);
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error, sent?: RCIMIWMessage) => {
      if (settled) return;
      settled = true;
      if (error) { reject(error); return; }
      const managed = sent ? toManagedMessage(sent) : null;
      if (managed) resolve({ ...managed, isMine: true });
      else reject(new Error('发送消息失败'));
    };
    void currentEngine.sendMessage(message, { onMessageSent: (code, sent) => code === 0 ? finish(undefined, sent) : finish(new Error(`发送消息失败（${code}）`)) }).then((code) => { if (code !== 0) finish(new Error(`发送消息失败（${code}）`)); }).catch((error) => finish(error instanceof Error ? error : new Error('发送消息失败')));
  });
}

export async function sendRongImage(targetId: string, path: string): Promise<ManagedMessage> {
  const sdk = loadSdk();
  if (!sdk) throw new Error('当前版本暂不支持即时消息');
  const currentEngine = requireConnected();
  const message = await currentEngine.createImageMessage(sdk.RCIMIWConversationType.PRIVATE, getRongConversationTargetId(targetId), '', path);
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error, sent?: RCIMIWMediaMessage) => {
      if (settled) return;
      settled = true;
      if (error) { reject(error); return; }
      const managed = sent ? toManagedMessage(sent) : null;
      if (managed) resolve({ ...managed, isMine: true });
      else reject(new Error('发送图片失败'));
    };
    void currentEngine.sendMediaMessage(message, { onMediaMessageSent: (code, sent) => code === 0 ? finish(undefined, sent) : finish(new Error(`发送图片失败（${code}）`)) }).then((code) => { if (code !== 0) finish(new Error(`发送图片失败（${code}）`)); }).catch((error) => finish(error instanceof Error ? error : new Error('发送图片失败')));
  });
}

export async function sendRongAfterSaleCard(targetId: string, payload: AfterSaleCardPayload): Promise<ManagedMessage> {
  const sdk = loadSdk();
  if (!sdk) throw new Error('当前版本暂不支持即时消息');
  const currentEngine = requireConnected();
  const fields = new Map<string, string>([['data', JSON.stringify(payload)], ['content', '【售后申请】订单 ' + (payload.orderNo || '')]]);
  const message = await currentEngine.createCustomMessage(sdk.RCIMIWConversationType.PRIVATE, getRongConversationTargetId(targetId), '', sdk.RCIMIWCustomMessagePolicy.NORMAL, 'PZAfterSaleApply', fields);
  return new Promise((resolve, reject) => {
    void currentEngine.sendMessage(message, { onMessageSent: (code, sent) => {
      if (code !== 0) return reject(new Error(`售后卡片发送失败（${code}）`));
      const managed = sent ? toManagedMessage(sent) : null;
      managed ? resolve({ ...managed, isMine: true }) : reject(new Error('发送消息失败'));
    } });
  });
}

export async function markRongConversationRead(targetId: string) {
  const sdk = loadSdk();
  if (!engine || !connected || !sdk || !targetId) return false;
  const rongTargetId = getRongConversationTargetId(targetId);
  const code = await engine.clearUnreadCount(sdk.RCIMIWConversationType.PRIVATE, rongTargetId, '', Date.now());
  if (code !== 0) throw new Error(`清除未读失败（${code}）`);
  // 上报服务端"已读至当前时间"，其他设备收到同步后清各自的未读数
  const syncCode = await engine.syncConversationReadStatus(sdk.RCIMIWConversationType.PRIVATE, rongTargetId, '', Date.now(), {
    onConversationReadStatusSynced: (result) => {
      if (result !== 0) {
        logger.warn('RongCloud conversation read status sync failed', { code: result, targetId });
      }
    },
  });
  if (syncCode !== 0) {
    logger.warn('RongCloud conversation read status sync failed', { code: syncCode, targetId });
  }
  return true;
}

// 与 Web 端保持一致：置顶写入融云服务端，保证多端同步。
export async function setRongConversationPinned(targetId: string, isPinned: boolean) {
  const sdk = loadSdk();
  if (!engine || !connected || !sdk || !targetId) return false;
  const code = await engine.changeConversationTopStatus(
    sdk.RCIMIWConversationType.PRIVATE,
    getRongConversationTargetId(targetId),
    '',
    isPinned,
  );
  if (code !== 0) throw new Error(`设置置顶失败（${code}）`);
  return true;
}

export async function disconnectRongCloud() {
  connectionEpoch += 1;
  cancelConnectionAttempt?.();
  connectionAttempt = null;
  hasStartedConnection = false;
  if (engine) await engine.disconnect(false);
  connected = false;
  businessToken = '';
  conversationListeners.clear();
  conversationSyncListeners.clear();
  conversationReadSyncListeners.clear();
  messageListeners.clear();
  connectionStatusListeners.clear();
}
