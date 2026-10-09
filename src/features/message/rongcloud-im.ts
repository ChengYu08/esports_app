import type {
  RCIMIWConversation,
  RCIMIWEngine,
  RCIMIWMediaMessage,
  RCIMIWMessage,
} from '@rongcloud/react-native-im-wrapper';

import { mapRongMessage, type RongSdkMessage } from './chat-message';
import type { ManagedMessage, MessageConversation, MessageHistoryPage } from './message-state';
import type { AfterSaleCardPayload } from '@/features/order/after-sale-card';

export type RongConversation = MessageConversation;
export type RongTextMessage = ManagedMessage;

type RongSdk = typeof import('@rongcloud/react-native-im-wrapper');
type ConversationListener = (conversation: RongConversation) => void;
type MessageListener = (peerId: string, message: ManagedMessage, conversation: RongConversation) => void;

let engine: RCIMIWEngine | null = null;
let connected = false;
let businessToken = '';
const conversationListeners = new Set<ConversationListener>();
const messageListeners = new Set<MessageListener>();

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
  const content = message as (RCIMIWMessage & { text?: string; content?: string }) | undefined;
  const enums = getSdkEnums();
  return {
    preview: content?.text || content?.content || (message?.messageType === enums?.imageType ? '[图片]' : '新消息'),
    time: message?.sentTime ? new Date(message.sentTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '',
  };
}

function mapConversation(conversation: RCIMIWConversation): RongConversation {
  const last = mapPreview(conversation.lastMessage);
  return {
    id: String(conversation.targetId || ''),
    title: String(conversation.targetId || '消息'),
    preview: last.preview,
    time: last.time,
    unreadCount: conversation.unreadCount || 0,
    updatedAt: conversation.lastMessage?.sentTime || 0,
  };
}

async function hydrateConversation(conversation: RongConversation) {
  if (!businessToken || !conversation.id) return conversation;
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
  } catch {
    return false;
  }
  const turboModuleEnabled = Boolean((globalThis as typeof globalThis & { __turboModuleProxy?: unknown }).__turboModuleProxy);
  const { env } = getRuntimeConfig();
  return platform !== 'web' && Boolean(env.rongCloudAppKey && (nativeModules.RCReactNativeIM || turboModuleEnabled));
}

export function toManagedMessage(message: RongSdkMessage | RCIMIWMessage, messageEnums = getSdkEnums()): ManagedMessage | null {
  if (!messageEnums) return null;
  const mapped = mapRongMessage(message as RongSdkMessage, { image: messageEnums.imageType, send: messageEnums.directionSend });
  if (!mapped) return null;
  return { ...mapped, status: 'sent', sentAt: message.sentTime || Date.now() };
}

function emitConversation(conversation: RongConversation) {
  conversationListeners.forEach((listener) => listener(conversation));
}

async function emitReceived(message: RCIMIWMessage) {
  const enums = getSdkEnums();
  const peerId = message.senderUserId || message.targetId;
  if (!enums || message.conversationType !== enums.conversationType || !peerId) return;
  const mapped = toManagedMessage(message);
  if (!mapped) return;
  const conversation = await hydrateConversation(mapConversation({
    targetId: peerId,
    conversationType: message.conversationType,
    lastMessage: message,
    unreadCount: 1,
  } as RCIMIWConversation));
  emitConversation(conversation);
  messageListeners.forEach((listener) => listener(peerId, mapped, conversation));
}

function installListeners() {
  if (!engine) return;
  engine.setOnMessageReceivedListener((message) => { void emitReceived(message); });
  engine.setOnConnectionStatusChangedListener((status) => {
    const sdk = loadSdk();
    connected = status === sdk?.RCIMIWConnectionStatus.CONNECTED;
  });
}

export function isRongCloudConnected() {
  return connected;
}

export async function connectRongCloud(accessToken: string) {
  if (!isRongCloudAvailable() || !accessToken) return false;
  businessToken = accessToken;
  if (!engine) {
    const sdk = loadSdk();
    if (!sdk) return false;
    try {
      const { env } = getRuntimeConfig();
      engine = sdk.RCIMIWEngine.create(env.rongCloudAppKey);
      installListeners();
    } catch {
      return false;
    }
  }
  if (connected) return true;
  try {
    const token = (await getClientAuthApi().getImToken(accessToken)).token;
    const sdk = loadSdk();
    if (!sdk) return false;
    connected = await new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (value: boolean) => { if (!settled) { settled = true; resolve(value); } };
      const timer = setTimeout(() => finish(false), 16_000);
      void engine?.connect(token, 15, {
        onConnected: (code) => { clearTimeout(timer); finish(code === 0); },
      }).then((code) => { if (code !== 0) { clearTimeout(timer); finish(false); } }).catch(() => { clearTimeout(timer); finish(false); });
    });
    return connected;
  } catch {
    connected = false;
    return false;
  }
}

export async function initializeRongCloud(accessToken: string) {
  return connectRongCloud(accessToken);
}

export async function getRongConversations(): Promise<RongConversation[]> {
  const sdk = loadSdk();
  if (!engine || !connected || !sdk) return [];
  return new Promise((resolve) => {
    void engine?.getConversations([sdk.RCIMIWConversationType.PRIVATE], '', 0, 50, {
      onSuccess: (conversations) => {
        void Promise.all((conversations || []).map(mapConversation).filter((item) => item.id).map(hydrateConversation)).then(resolve);
      },
      onError: () => resolve([]),
    }).then((code) => { if (code !== 0) resolve([]); }).catch(() => resolve([]));
  });
}

export function subscribeRongMessages(onMessage: ConversationListener) {
  conversationListeners.add(onMessage);
  return () => conversationListeners.delete(onMessage);
}

export function subscribeRongConversationMessages(targetId: string, onMessage: (message: ManagedMessage) => void) {
  const listener: MessageListener = (peerId, message) => { if (peerId === targetId) onMessage(message); };
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
      targetId,
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
  const message = await currentEngine.createTextMessage(sdk.RCIMIWConversationType.PRIVATE, targetId, '', text);
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
  const message = await currentEngine.createImageMessage(sdk.RCIMIWConversationType.PRIVATE, targetId, '', path);
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
  const message = await currentEngine.createCustomMessage(sdk.RCIMIWConversationType.PRIVATE, targetId, '', sdk.RCIMIWCustomMessagePolicy.NORMAL, 'PZAfterSaleApply', fields);
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
  const code = await engine.clearUnreadCount(sdk.RCIMIWConversationType.PRIVATE, targetId, '', Date.now());
  if (code !== 0) throw new Error(`清除未读失败（${code}）`);
  return true;
}

export async function disconnectRongCloud() {
  if (engine) await engine.disconnect(false);
  connected = false;
  businessToken = '';
  conversationListeners.clear();
  messageListeners.clear();
}
