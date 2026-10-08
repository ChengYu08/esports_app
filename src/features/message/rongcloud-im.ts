import { NativeModules, Platform } from 'react-native';
import type { RCIMIWConversation, RCIMIWEngine, RCIMIWMessage } from '@rongcloud/react-native-im-wrapper';

import { clientAuthApi } from '@/features/auth/client-auth.api';
import { env } from '@/core/config/env';

export type RongConversation = { id: string; title: string; preview: string; time: string; avatar?: string; unreadCount?: number };

let engine: RCIMIWEngine | null = null;
let connected = false;
let messageHandler: ((conversation: RongConversation) => void) | null = null;
let businessToken = '';
const PRIVATE = 1;
const IMAGE = 4;

function mapMessage(message?: RCIMIWMessage): Pick<RongConversation, 'preview' | 'time'> {
  const content = message as (RCIMIWMessage & { text?: string; content?: string }) | undefined;
  return { preview: content?.text || content?.content || (message?.messageType === IMAGE ? '[图片]' : '新消息'), time: message?.sentTime ? new Date(message.sentTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '' };
}

function mapConversation(conversation: RCIMIWConversation): RongConversation {
  const last = mapMessage(conversation.lastMessage);
  return { id: String(conversation.targetId || ''), title: String(conversation.targetId || '消息'), preview: last.preview, time: last.time, unreadCount: conversation.unreadCount };
}

async function hydrateConversation(conversation: RongConversation) {
  if (!businessToken || !conversation.id) return conversation;
  try {
    const profile = await clientAuthApi.getUserProfile(businessToken, conversation.id);
    return { ...conversation, title: profile.nickname || conversation.title, avatar: profile.headImage || undefined };
  } catch {
    return conversation;
  }
}

export function isRongCloudAvailable() {
  const turboModuleEnabled = Boolean((global as typeof globalThis & { __turboModuleProxy?: unknown }).__turboModuleProxy);
  return Platform.OS !== 'web' && Boolean(env.rongCloudAppKey && (NativeModules.RCReactNativeIM || turboModuleEnabled));
}

export async function connectRongCloud(accessToken: string) {
  if (!isRongCloudAvailable() || !accessToken) return false;
  businessToken = accessToken;
  if (!engine) {
    // The package is loaded lazily so Expo Go (which has no RongCloud native
    // module) keeps working. Development builds load the official native SDK.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    try {
      const { RCIMIWEngine: Engine } = require('@rongcloud/react-native-im-wrapper') as typeof import('@rongcloud/react-native-im-wrapper');
      engine = Engine.create(env.rongCloudAppKey);
    } catch {
      return false;
    }
    engine.setOnMessageReceivedListener((message) => {
      const peerId = message.senderUserId || message.targetId;
      if (message.conversationType === PRIVATE && peerId) void hydrateConversation(mapConversation({ targetId: peerId, conversationType: message.conversationType, lastMessage: message })).then((conversation) => messageHandler?.(conversation));
    });
    engine.setOnConnectionStatusChangedListener((status) => { connected = status === 1; });
  }
  if (!connected) {
    const token = (await clientAuthApi.getImToken(accessToken)).token;
    connected = await new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), 16_000);
      void engine?.connect(token, 15, { onConnected: (code) => { clearTimeout(timer); resolve(code === 0); } }).then((code) => {
        if (code !== 0) { clearTimeout(timer); resolve(false); }
      }).catch(() => { clearTimeout(timer); resolve(false); });
    });
  }
  return connected;
}

export async function getRongConversations(): Promise<RongConversation[]> {
  if (!engine || !connected) return [];
  return new Promise((resolve) => { engine?.getConversations([PRIVATE], '', 0, 50, { onSuccess: (conversations) => { void Promise.all((conversations || []).map(mapConversation).map(hydrateConversation)).then(resolve); }, onError: () => resolve([]) }); });
}

export function subscribeRongMessages(onMessage: (conversation: RongConversation) => void) {
  messageHandler = onMessage;
  return () => { if (messageHandler === onMessage) messageHandler = null; };
}

export async function sendRongText(targetId: string, text: string) {
  if (!engine || !connected) throw new Error('融云尚未连接');
  const message = await engine.createTextMessage(PRIVATE, targetId, '', text);
  const code = await engine.sendMessage(message);
  if (code !== 0) throw new Error(`发送消息失败（${code}）`);
}

export async function disconnectRongCloud() {
  if (engine) await engine.disconnect(false);
  connected = false;
  businessToken = '';
  messageHandler = null;
}
