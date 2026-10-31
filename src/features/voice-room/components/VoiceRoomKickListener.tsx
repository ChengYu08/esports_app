import { useAuthStore } from "@esports/auth";
import { useEffect } from "react";

import {
  subscribeRongChatRoomBlocked,
  subscribeRongChatRoomDestroyed,
} from "@/features/message/rongcloud-im";
import { useAppConfirm } from "@/shared/ui/app-confirm";

import { handleVoiceRoomBlocked, handleVoiceRoomDestroyed } from "../voice-room-kicked";

function showKickedAlert() {
  void useAppConfirm.getState().confirm({
    title: "已退出语聊房",
    message: "你已被移出语聊房，暂时无法重新进入",
    confirmText: "我知道了",
  });
}

function showDestroyedAlert() {
  void useAppConfirm.getState().confirm({
    title: "语聊房已关闭",
    message: "语聊房聊天室已关闭，请重新开启房间",
    confirmText: "我知道了",
  });
}

/** 订阅 chatRoomBlocked 与聊天室销毁状态；ROOM_KICKED 命令由 RongCommandHost 注册处理 */
export function VoiceRoomKickListener() {
  useEffect(() => {
    const unsubscribeBlocked = subscribeRongChatRoomBlocked((event) => {
      const { accessToken, user } = useAuthStore.getState();
      const userId = accessToken && user?.id != null ? String(user.id) : "";
      void handleVoiceRoomBlocked(event, userId, showKickedAlert);
    });
    const unsubscribeDestroyed = subscribeRongChatRoomDestroyed((chatroomId) => {
      void handleVoiceRoomDestroyed(chatroomId, showDestroyedAlert);
    });
    return () => {
      unsubscribeBlocked();
      unsubscribeDestroyed();
    };
  }, []);
  return null;
}
