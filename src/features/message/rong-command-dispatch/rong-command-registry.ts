import { logger } from "@/core/logging/logger";
import type { RongCommand } from "@/features/message/rongcloud-command";

import type { RongCommandHandler } from "./types";

const handlers = new Map<string, RongCommandHandler>();

export function registerRongCommandHandler(handler: RongCommandHandler): () => void {
  handlers.set(handler.id, handler);
  return () => {
    if (handlers.get(handler.id) === handler) {
      handlers.delete(handler.id);
    }
  };
}

/** 仅测试用：清空全部已注册 handler */
export function clearRongCommandHandlers() {
  handlers.clear();
}

export function dispatchRongCommand(
  command: RongCommand,
  auth: { accessToken: string | null | undefined; userId: string },
) {
  const ctx = { userId: auth.userId };
  for (const handler of handlers.values()) {
    const requireAuth = handler.requireAuth !== false;
    if (requireAuth && !auth.accessToken) {
      logger.warn("rong_command.skipped_no_auth", {
        name: command.name,
        handlerId: handler.id,
      });
      continue;
    }
    handler.handle(command, ctx);
  }
}
