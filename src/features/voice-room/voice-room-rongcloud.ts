import { logger } from "@/core/logging/logger";
import {
    pickRongImageUrl,
    type RongSdkMessage,
} from "@/features/message/chat-message";
import type {
    RCIMIWEngine,
    RCIMIWMessage,
    RCIMIWTextMessage,
} from "@rongcloud/react-native-im-wrapper";

import {
    getRongCloudEngine,
    initializeRongCloud,
    isRongCloudConnected,
    subscribeRongChatRoomMembers,
    subscribeRongChatRoomMessages,
    subscribeRongConnectionStatus,
} from "@/features/message/rongcloud-im";

import {
    appendCachedVoiceChatMessage,
    clearVoiceChatMessageCache,
} from "./voice-room-message-cache";

/** 进房不拉本地历史（对齐 PC count:-1）；历史统一走 getChatRoomMessages 云端接口 */
const JOIN_CHATROOM_MESSAGE_COUNT = -1;
/** 云端历史单页上限（融云约束 0 < count ≤ 50） */
const CHATROOM_HISTORY_PAGE_SIZE = 50;

type RongSdk = typeof import("@rongcloud/react-native-im-wrapper");
type RoomMessage = {
  id: string;
  userId?: string;
  nickname?: string;
  avatar?: string;
  text: string;
  imageUrl?: string;
  sentAt: number;
};

type VoiceChatSender = {
  userId: string;
  nickname?: string;
  headImage?: string;
};

const roomMessageListeners = new Set<
  (chatroomId: string, message: RoomMessage) => void
>();
const roomMemberListeners = new Set<
  (
    targetId: string,
    actions: { userId?: string; actionType?: number }[],
  ) => void
>();
let listenersInstalled = false;
const joinedChatroomIds = new Set<string>();
// 融云聊天室成员事件不存离线：屏内无人订阅期间（最小化/首屏未挂载）先缓冲，
// 首个订阅者挂载时冲刷，避免已加入/已离开的成员丢失
const MAX_BUFFERED_MEMBER_ACTIONS = 100;
const bufferedMemberActions = new Map<
  string,
  { userId?: string; actionType?: number }[]
>();

function loadSdk(): RongSdk | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("@rongcloud/react-native-im-wrapper") as RongSdk;
  } catch {
    return null;
  }
}

function installRoomListeners() {
  if (listenersInstalled) return;
  const engine = getRongCloudEngine();
  // 转发链路不依赖 SDK 枚举（normalizeRoomMessage 内部自行 loadSdk），
  // 引擎就绪即可安装；SDK 不可用时成员/连接事件仍需照常转发
  if (!engine) return;
  listenersInstalled = true;
  subscribeRongChatRoomMembers((targetId, actions) => {
    if (joinedChatroomIds.has(targetId) && roomMemberListeners.size === 0) {
      const buffer = bufferedMemberActions.get(targetId) ?? [];
      buffer.push(...actions);
      if (buffer.length > MAX_BUFFERED_MEMBER_ACTIONS) {
        buffer.splice(0, buffer.length - MAX_BUFFERED_MEMBER_ACTIONS);
      }
      bufferedMemberActions.set(targetId, buffer);
      return;
    }
    roomMemberListeners.forEach((listener) => listener(targetId, actions));
  });
  subscribeRongChatRoomMessages((_targetId, message: RCIMIWMessage) => {
    const normalized = normalizeRoomMessage(message);
    if (!normalized) return;
    // 屏幕最小化期间屏内订阅已断开，这里把消息累积到会话级缓存，重进时可恢复
    if (joinedChatroomIds.has(_targetId)) {
      appendCachedVoiceChatMessage(_targetId, { ...normalized, kind: "chat" });
    }
    roomMessageListeners.forEach((listener) => listener(_targetId, normalized));
  });
}

// PC 端开黑房会发 RC:ImgMsg（融云 ImageMessage，imageUri 在 remote 上），
// 只认 text 会把图片消息整个丢弃，这里按 SDK 枚举识别图片类型
function normalizeRoomMessage(message: RCIMIWMessage): RoomMessage | null {
  const sdk = loadSdk();
  const sdkMessage = message as RCIMIWTextMessage & RongSdkMessage;
  const isImage =
    sdk != null && sdkMessage.messageType === sdk.RCIMIWMessageType.IMAGE;
  const text = sdkMessage.text ?? "";
  // App 端发送的图片会把发送方的 localPath 带进消息体，接收方必须优先 remote；
  // 聊天室不会回显自己发的消息，这里再按 direction 兜底区分本地/远端优先级
  const isMine =
    sdk != null && message.direction === sdk.RCIMIWMessageDirection.SEND;
  const imageUrl = pickRongImageUrl(sdkMessage, isMine);
  if (!text && !(isImage && imageUrl)) return null;
  const messageId = String(message.messageUId || message.messageId || message.sentTime);
  const nickname = message.userInfo?.name;
  if (!nickname) {
    logger.info('voice_room.chat_message_missing_nickname', {
      userId: message.senderUserId,
      messageId,
      text: text.slice(0, 40),
      hasImage: Boolean(isImage && imageUrl),
    });
  }
  return {
    id: messageId,
    userId: message.senderUserId,
    nickname,
    avatar: message.userInfo?.portrait,
    text,
    ...(isImage && imageUrl ? { imageUrl } : {}),
    sentAt: message.sentTime || Date.now(),
  };
}

export async function joinVoiceChatRoom(
  accessToken: string,
  chatroomId: string,
) {
  if (joinedChatroomIds.has(chatroomId)) return loadSdk();
  const connected =
    isRongCloudConnected() || (await initializeRongCloud(accessToken));
  if (!connected) throw new Error("融云连接不可用");
  const engine = getRongCloudEngine();
  if (!engine) throw new Error("融云 SDK 不可用");
  installRoomListeners();
  const sdk = loadSdk();
  const code = await new Promise<number>((resolve, reject) => {
    void engine
      .joinChatRoom(chatroomId, JOIN_CHATROOM_MESSAGE_COUNT, false, {
        onChatRoomJoined: (result) =>
          result === 0
            ? resolve(result)
            : reject(new Error(`加入开黑房失败（${result}）`)),
      })
      .then((result) => {
        if (result !== 0) reject(new Error(`加入开黑房失败（${result}）`));
      })
      .catch(reject);
  });
  if (code !== 0) throw new Error(`加入开黑房失败（${code}）`);
  joinedChatroomIds.add(chatroomId);
  return sdk;
}

export async function leaveVoiceChatRoom(chatroomId: string) {
  const engine = getRongCloudEngine();
  // A kicked user may already be absent on the server; always discard the
  // local joined marker so a later permitted join actually reaches the SDK.
  joinedChatroomIds.delete(chatroomId);
  bufferedMemberActions.delete(chatroomId);
  // 真正退房才清消息缓存；最小化只卸载屏组件、不退房，记录保留供重进恢复
  clearVoiceChatMessageCache(chatroomId);
  if (engine) await engine.leaveChatRoom(chatroomId);
}

export async function getVoiceChatHistory(chatroomId: string) {
  const engine = getRongCloudEngine();
  const sdk = loadSdk();
  if (!engine || !sdk || !isRongCloudConnected()) {
    logger.warn("voice_room.history_skipped", {
      chatroomId,
      hasEngine: Boolean(engine),
      hasSdk: Boolean(sdk),
      connected: isRongCloudConnected(),
    });
    return [];
  }
  logger.info("voice_room.history_fetch_start", {
    chatroomId,
    count: CHATROOM_HISTORY_PAGE_SIZE,
  });
  return new Promise<RoomMessage[]>((resolve, reject) => {
    let settled = false;
    const finish = (messages: RoomMessage[] | Error) => {
      if (settled) return;
      settled = true;
      if (messages instanceof Error) reject(messages);
      else resolve(messages);
    };
    void engine
      .getChatRoomMessages(
        chatroomId,
        0,
        sdk.RCIMIWTimeOrder.BEFORE,
        CHATROOM_HISTORY_PAGE_SIZE,
        {
          onSuccess: (messages) => {
            const rawCount = messages?.length ?? 0;
            const mapped = (messages || [])
              .map(normalizeRoomMessage)
              .filter((message): message is RoomMessage => Boolean(message))
              .sort((left, right) => left.sentAt - right.sentAt);
            logger.info("voice_room.history_fetch_success", {
              chatroomId,
              rawCount,
              mappedCount: mapped.length,
            });
            finish(mapped);
          },
          onError: (code) => {
            logger.warn("voice_room.history_fetch_error", { chatroomId, code });
            finish(new Error(`聊天室历史消息拉取失败（${code}）`));
          },
        },
      )
      .then((code) => {
        if (code !== 0) {
          logger.warn("voice_room.history_fetch_invoke_failed", {
            chatroomId,
            code,
          });
          finish(new Error(`聊天室历史消息拉取失败（${code}）`));
        }
      })
      .catch((error: unknown) => {
        logger.warn("voice_room.history_fetch_exception", {
          chatroomId,
          message: error instanceof Error ? error.message : String(error),
        });
        finish(
          error instanceof Error ? error : new Error("聊天室历史消息拉取失败"),
        );
      });
  });
}

export async function sendVoiceChatMessage(
  chatroomId: string,
  text: string,
  sender?: VoiceChatSender,
) {
  const engine = getRongCloudEngine();
  const sdk = loadSdk();
  if (!engine || !sdk) throw new Error("融云 SDK 不可用");
  const message = await engine.createTextMessage(
    sdk.RCIMIWConversationType.CHATROOM,
    chatroomId,
    "",
    text,
  );
  if (sender) {
    message.userInfo = {
      userId: sender.userId,
      name: sender.nickname || `用户${sender.userId}`,
      portrait: sender.headImage || "",
    };
  }
  let sent: RCIMIWMessage | undefined;
  const code = await engine.sendMessage(message, {
    onMessageSent: (result: number, item?: RCIMIWMessage) => {
      if (result === 0) sent = item;
    },
  });
  if (code !== 0) throw new Error(`发送消息失败（${code}）`);
  return sent;
}

/**
 * 融云私有存储的媒体 URL 直接访问会 401，图片必须先上传自家 OSS、
 * 把公网地址预置到消息 remote 后用 sendMessage 直发——自带远端地址的
 * 媒体消息不经融云文件服务托管（官方文档支持该用法），接收方与 PC 端
 * 拿到的都是可直接显示的公网 URL。
 */
export async function sendVoiceChatImageMessage(
  engine: Pick<RCIMIWEngine, "createImageMessage" | "sendMessage">,
  conversationType: number,
  targetId: string,
  imagePath: string,
  imageUrl: string,
  sender?: VoiceChatSender,
) {
  const message = await engine.createImageMessage(
    conversationType,
    targetId,
    "",
    imagePath,
  );
  if (sender) {
    message.userInfo = {
      userId: sender.userId,
      name: sender.nickname || `用户${sender.userId}`,
      portrait: sender.headImage || "",
    };
  }
  message.remote = imageUrl;
  const code = await engine.sendMessage(message, {});
  if (code !== 0) throw new Error(`发送图片失败（${code}）`);
}

export async function sendVoiceChatImage(
  chatroomId: string,
  imagePath: string,
  imageUrl: string,
  sender?: VoiceChatSender,
) {
  const engine = getRongCloudEngine();
  const sdk = loadSdk();
  if (!engine || !sdk) throw new Error("融云 SDK 不可用");
  return sendVoiceChatImageMessage(
    engine,
    sdk.RCIMIWConversationType.CHATROOM,
    chatroomId,
    imagePath,
    imageUrl,
    sender,
  );
}

export function subscribeVoiceChatMessages(
  listener: (chatroomId: string, message: RoomMessage) => void,
) {
  roomMessageListeners.add(listener);
  return () => roomMessageListeners.delete(listener);
}

export function subscribeVoiceChatMembers(
  listener: (
    targetId: string,
    actions: { userId?: string; actionType?: number }[],
  ) => void,
) {
  if (roomMemberListeners.size === 0) {
    bufferedMemberActions.forEach((actions, targetId) =>
      listener(targetId, actions),
    );
    bufferedMemberActions.clear();
  }
  roomMemberListeners.add(listener);
  return () => roomMemberListeners.delete(listener);
}

export function subscribeVoiceChatConnection(
  listener: (connected: boolean) => void,
) {
  return subscribeRongConnectionStatus((signal) =>
    listener(signal === "connected"),
  );
}
