import { useAuthStore } from "@esports/auth";
import { useEffect } from "react";

import { logger } from "@/core/logging/logger";
import { registerActionCommandHandlers } from "@/features/message/action-command/register-action-command-handlers";
import { subscribeRongCommands } from "@/features/message/rongcloud-im";
import { registerReceptionCommandHandlers } from "@/features/voice-room/reception-command-handlers";
import { registerVoiceRoomKickCommandHandlers } from "@/features/voice-room/register-voice-room-kick-command-handlers";

import { dispatchRongCommand } from "./rong-command-registry";

export function RongCommandHost() {
  useEffect(() => {
    const unregisters = [
      registerActionCommandHandlers(),
      registerReceptionCommandHandlers(),
      registerVoiceRoomKickCommandHandlers(),
    ];
    const stop = subscribeRongCommands((command) => {
      logger.info("rong_command.received", {
        name: command.name,
        senderId: command.senderId,
      });
      const { accessToken, user } = useAuthStore.getState();
      const userId = accessToken && user?.id != null ? String(user.id) : "";
      dispatchRongCommand(command, { accessToken, userId });
    });
    return () => {
      stop();
      unregisters.forEach((unregister) => unregister());
    };
  }, []);

  return null;
}
