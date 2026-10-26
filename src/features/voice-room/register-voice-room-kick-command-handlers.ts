import { Alert } from "react-native";

import { registerRongCommandHandler } from "@/features/message/rong-command-dispatch/rong-command-registry";

import { handleVoiceRoomKicked } from "./voice-room-kicked";

function showKickedAlert() {
  Alert.alert("已退出语聊房", "你已被移出语聊房，暂时无法重新进入", [{ text: "我知道了" }], {
    cancelable: false,
  });
}

export function registerVoiceRoomKickCommandHandlers(): () => void {
  return registerRongCommandHandler({
    id: "voice-room-kick",
    requireAuth: false,
    handle(command, ctx) {
      void handleVoiceRoomKicked(command, ctx.userId, showKickedAlert);
    },
  });
}
