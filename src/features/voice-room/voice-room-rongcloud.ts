import type { RCIMIWMessage, RCIMIWTextMessage } from '@rongcloud/react-native-im-wrapper';

import {
  initializeRongCloud,
  isRongCloudConnected,
  getRongCloudEngine,
  subscribeRongChatRoomMessages,
  subscribeRongChatRoomMembers,
  subscribeRongConnectionStatus,
} from '@/features/message/rongcloud-im';

type RongSdk = typeof import('@rongcloud/react-native-im-wrapper');
type RoomMessage = { id: string; userId?: string; nickname?: string; text: string; sentAt: number };

const roomMessageListeners = new Set<(chatroomId: string, message: RoomMessage) => void>();
const roomMemberListeners = new Set<(targetId: string, actions: { userId?: string; actionType?: number }[]) => void>();
let listenersInstalled = false;
const joinedChatroomIds = new Set<string>();

function loadSdk(): RongSdk | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@rongcloud/react-native-im-wrapper') as RongSdk;
  } catch {
    return null;
  }
}

function installRoomListeners() {
  if (listenersInstalled) return;
  const engine = getRongCloudEngine();
  if (!engine || !loadSdk()) return;
  listenersInstalled = true;
  subscribeRongChatRoomMembers((targetId, actions) => {
    roomMemberListeners.forEach((listener) => listener(targetId, actions));
  });
  subscribeRongChatRoomMessages((_targetId, message: RCIMIWMessage) => {
    const normalized = normalizeRoomMessage(message);
    if (normalized) roomMessageListeners.forEach((listener) => listener(_targetId, normalized));
  });
}

function normalizeRoomMessage(message: RCIMIWMessage): RoomMessage | null {
  const text = (message as RCIMIWTextMessage).text;
  if (!text) return null;
  return {
    id: String(message.messageUId || message.messageId || message.sentTime),
    userId: message.senderUserId,
    text,
    sentAt: message.sentTime || Date.now(),
  };
}

export async function joinVoiceChatRoom(accessToken: string, chatroomId: string) {
  if (joinedChatroomIds.has(chatroomId)) return loadSdk();
  const connected = isRongCloudConnected() || await initializeRongCloud(accessToken);
  if (!connected) throw new Error('融云连接不可用');
  const engine = getRongCloudEngine();
  if (!engine) throw new Error('融云 SDK 不可用');
  installRoomListeners();
  const sdk = loadSdk();
  const code = await new Promise<number>((resolve, reject) => {
    void engine.joinChatRoom(chatroomId, 50, false, {
      onChatRoomJoined: (result) => result === 0 ? resolve(result) : reject(new Error(`加入语聊房失败（${result}）`)),
    }).then((result) => {
      if (result !== 0) reject(new Error(`加入语聊房失败（${result}）`));
    }).catch(reject);
  });
  if (code !== 0) throw new Error(`加入语聊房失败（${code}）`);
  joinedChatroomIds.add(chatroomId);
  return sdk;
}

export async function leaveVoiceChatRoom(chatroomId: string) {
  const engine = getRongCloudEngine();
  // A kicked user may already be absent on the server; always discard the
  // local joined marker so a later permitted join actually reaches the SDK.
  joinedChatroomIds.delete(chatroomId);
  if (engine) await engine.leaveChatRoom(chatroomId);
}

export async function getVoiceChatHistory(chatroomId: string) {
  const engine = getRongCloudEngine();
  const sdk = loadSdk();
  if (!engine || !sdk || !isRongCloudConnected()) return [];
  return new Promise<RoomMessage[]>((resolve, reject) => {
    let settled = false;
    const finish = (messages: RoomMessage[] | Error) => {
      if (settled) return;
      settled = true;
      if (messages instanceof Error) reject(messages);
      else resolve(messages);
    };
    void engine.getChatRoomMessages(
      chatroomId,
      0,
      sdk.RCIMIWTimeOrder.BEFORE,
      50,
      {
        onSuccess: (messages) => finish((messages || [])
          .map(normalizeRoomMessage)
          .filter((message): message is RoomMessage => Boolean(message))
          .sort((left, right) => left.sentAt - right.sentAt)),
        onError: (code) => finish(new Error(`聊天室历史消息拉取失败（${code}）`)),
      },
    ).then((code) => {
      if (code !== 0) finish(new Error(`聊天室历史消息拉取失败（${code}）`));
    }).catch((error: unknown) => finish(error instanceof Error ? error : new Error('聊天室历史消息拉取失败')));
  });
}

export async function sendVoiceChatMessage(chatroomId: string, text: string) {
  const engine = getRongCloudEngine();
  const sdk = loadSdk();
  if (!engine || !sdk) throw new Error('融云 SDK 不可用');
  const message = await engine.createTextMessage(sdk.RCIMIWConversationType.CHATROOM, chatroomId, '', text);
  let sent: RCIMIWMessage | undefined;
  const code = await engine.sendMessage(message, { onMessageSent: (result: number, item?: RCIMIWMessage) => { if (result === 0) sent = item; } });
  if (code !== 0) throw new Error(`发送消息失败（${code}）`);
  return sent;
}

export function subscribeVoiceChatMessages(listener: (chatroomId: string, message: RoomMessage) => void) {
  roomMessageListeners.add(listener);
  return () => roomMessageListeners.delete(listener);
}

export function subscribeVoiceChatMembers(listener: (targetId: string, actions: { userId?: string; actionType?: number }[]) => void) {
  roomMemberListeners.add(listener);
  return () => roomMemberListeners.delete(listener);
}

export function subscribeVoiceChatConnection(listener: (connected: boolean) => void) {
  return subscribeRongConnectionStatus((signal) => listener(signal === 'connected'));
}

