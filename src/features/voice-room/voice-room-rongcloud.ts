import type { RCIMIWMessage } from '@rongcloud/react-native-im-wrapper';

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

const roomMessageListeners = new Set<(message: RoomMessage) => void>();
const roomMemberListeners = new Set<(targetId: string, actions: { userId?: string; actionType?: number }[]) => void>();
let listenersInstalled = false;

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
    const text = (message as RCIMIWMessage & { text?: string }).text;
    if (!text) return;
    roomMessageListeners.forEach((listener) => listener({
      id: String(message.messageUId || message.messageId || message.sentTime),
      userId: message.senderUserId,
      text,
      sentAt: message.sentTime || Date.now(),
    }));
  });
}

export async function joinVoiceChatRoom(accessToken: string, chatroomId: string) {
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
  return sdk;
}

export async function leaveVoiceChatRoom(chatroomId: string) {
  const engine = getRongCloudEngine();
  if (engine) await engine.leaveChatRoom(chatroomId);
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

export function subscribeVoiceChatMessages(listener: (message: RoomMessage) => void) {
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

