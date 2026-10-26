import { registerRongCommandHandler } from "@/features/message/rong-command-dispatch/rong-command-registry";
import { useAppConfirm } from "@/shared/ui/app-confirm";

import { handleVoiceRoomKicked } from "./voice-room-kicked";

function showKickedAlert() {
  void useAppConfirm.getState().confirm({
    title: "已退出语聊房",
    message: "你已被移出语聊房，暂时无法重新进入",
    confirmText: "我知道了",
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
