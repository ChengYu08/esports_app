import { useCallback, useRef, useState } from "react";
import type {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from "react-native";

import { displayMessage, messageKeyExtractor } from "./message-display";
import type { VoiceRoomMemberRole, VoiceRoomMessage } from "./voice-room.types";

const MESSAGE_NEAR_BOTTOM_THRESHOLD = 80;

export function useVoiceRoomMessages(
  roleByUserId: (userId?: string) => VoiceRoomMemberRole | undefined,
) {
  const [messages, setMessages] = useState<VoiceRoomMessage[]>([
    {
      id: "welcome",
      kind: "notice",
      text: "欢迎来到盼之电竞，请文明交流，禁止发布辱骂、涉政、暴力、广告、色情低俗等内容，禁止违规私下交易，频道内容采取24小时人工巡查，如有任何违规信息，请及时举报，以防上当受骗！",
      sentAt: 1,
    },
  ]);
  const messageListRef = useRef<FlatList<VoiceRoomMessage>>(null);
  const nearBottomRef = useRef(true);

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
