import { useAuthStore } from "@esports/auth";
import { useEffect } from "react";

import { subscribeRongChatRoomBlocked } from "@/features/message/rongcloud-im";
import { useAppConfirm } from "@/shared/ui/app-confirm";

import { handleVoiceRoomBlocked } from "../voice-room-kicked";

function showKickedAlert() {
  void useAppConfirm.getState().confirm({
    title: "已退出语聊房",
    message: "你已被移出语聊房，暂时无法重新进入",
    confirmText: "我知道了",
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
