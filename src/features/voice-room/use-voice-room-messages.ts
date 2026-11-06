import { useCallback, useEffect, useRef, useState } from "react";
import type { SetStateAction } from "react";
import type {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from "react-native";

import { displayMessage, messageKeyExtractor } from "./message-display";
import {
  getCachedVoiceChatMessages,
  setCachedVoiceChatMessages,
} from "./voice-room-message-cache";
import type { VoiceRoomMemberRole, VoiceRoomMessage } from "./voice-room.types";

const MESSAGE_NEAR_BOTTOM_THRESHOLD = 80;

const WELCOME_NOTICE: VoiceRoomMessage = {
  id: "welcome",
  kind: "notice",
  text: "欢迎来到盼之电竞，请文明交流，禁止发布辱骂、涉政、暴力、广告、色情低俗等内容，禁止违规私下交易，频道内容采取24小时人工巡查，如有任何违规信息，请及时举报，以防上当受骗！",
  sentAt: 1,
};

export function useVoiceRoomMessages(
  roleByUserId: (userId?: string) => VoiceRoomMemberRole | undefined,
  chatroomId?: string,
) {
  const [messages, setMessagesState] = useState<VoiceRoomMessage[]>([
    WELCOME_NOTICE,
  ]);
  const messagesRoomRef = useRef<string | undefined>(undefined);
  const messageListRef = useRef<FlatList<VoiceRoomMessage>>(null);
  const nearBottomRef = useRef(true);

  // 悬浮窗最小化只是卸载屏组件，融云聊天室仍保持加入。消息缓存在模块层
  // 随分发层持续累积，chatroomId 就绪或房内切房时在这里恢复对应房间的记录
  useEffect(() => {
    if (!chatroomId) return;
    const cached = getCachedVoiceChatMessages(chatroomId);
    const restored = cached.length > 0 ? cached : [WELCOME_NOTICE];
    messagesRoomRef.current = chatroomId;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- chatroomId 变化时从会话级缓存整体恢复，属于外部存储同步
    setMessagesState(restored);
    setCachedVoiceChatMessages(chatroomId, restored);
  }, [chatroomId]);

  // 屏内每次消息变更同步回缓存，作为重进房间时的恢复源。
  // 依赖 messagesRoomRef 保持引用稳定：setMessages 在进房 hook 的依赖数组里，
  // 若随 chatroomId 变化会导致进房流程被取消重跑
  const setMessages = useCallback(
    (update: SetStateAction<VoiceRoomMessage[]>) => {
      setMessagesState((prev) => {
        const next =
          typeof update === "function" ? update(prev) : update;
        const room = messagesRoomRef.current;
        if (room) {
          setCachedVoiceChatMessages(room, next);
        }
        return next;
      });
    },
    [],
  );

  const renderMessageItem = useCallback(
    ({ item }: { item: VoiceRoomMessage }) =>
      displayMessage(item, roleByUserId(item.userId)),
    [roleByUserId],
  );

  const handleMessageScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { layoutMeasurement, contentOffset, contentSize } =
        event.nativeEvent;
      nearBottomRef.current =
        contentOffset.y + layoutMeasurement.height >=
        contentSize.height - MESSAGE_NEAR_BOTTOM_THRESHOLD;
    },
    [],
  );

  const handleMessageContentSizeChange = useCallback(() => {
    if (!nearBottomRef.current) return;
    messageListRef.current?.scrollToEnd({ animated: true });
  }, []);

  const followLatestMessage = useCallback(() => {
    nearBottomRef.current = true;
  }, []);

  return {
    messages,
    setMessages,
    messageListRef,
    renderMessageItem,
    messageKeyExtractor,
    handleMessageScroll,
    handleMessageContentSizeChange,
    followLatestMessage,
  };
}
