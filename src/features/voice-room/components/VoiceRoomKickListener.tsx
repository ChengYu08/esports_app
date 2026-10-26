import { useAuthStore } from "@esports/auth";
import { useEffect } from "react";
import { Alert } from "react-native";

import { subscribeRongChatRoomBlocked } from "@/features/message/rongcloud-im";

import { handleVoiceRoomBlocked } from "../voice-room-kicked";

function showKickedAlert() {
  Alert.alert("已退出语聊房", "你已被移出语聊房，暂时无法重新进入", [{ text: "我知道了" }], {
    cancelable: false,
  });
}

/** 仅订阅 chatRoomBlocked；ROOM_KICKED 命令由 RongCommandHost 注册处理 */
export function VoiceRoomKickListener() {
  useEffect(() => {
    return subscribeRongChatRoomBlocked((event) => {
      const { accessToken, user } = useAuthStore.getState();
      const userId = accessToken && user?.id != null ? String(user.id) : "";
      void handleVoiceRoomBlocked(event, userId, showKickedAlert);
    });
  }, []);
  return null;
}
