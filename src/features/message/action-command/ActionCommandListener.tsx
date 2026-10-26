/**
 * 操作型命令信令监听：
 * - QUICK_MATCH_NOTICE：快速匹配抢单通知 → 全局 ActionNotice 条
 * - ORDER_NOTIFY（RC:CmdMsg 弹窗信令，仅支付事件）：支付催单弹窗（接单按钮）
 * - QUICK_MATCH_EXPIRED / QUICK_MATCH_CANCELLED：终止信号（撤条 + 消费方结束会话）
 */
import { useAuthStore } from "@esports/auth";
import { useEffect } from "react";

import { logger } from "@/core/logging/logger";
import { useQuickMatchEndSignals } from "@/features/match/quick-match-end-signals";
import { subscribeRongCommands } from "@/features/message/rongcloud-im";
import { actionNotice } from "@/shared/ui/action-notice/action-notice-store";
import { useActionCommandDialog } from "./action-command-store";
import {
  handleOrderNotifyPopup,
  handleQuickMatchExpired,
  handleQuickMatchNotice,
} from "./action-command-handlers";

export function ActionCommandListener() {
  useEffect(() => {
    return subscribeRongCommands((command) => {
      logger.info("action_command.received", {
        name: command.name,
        senderId: command.senderId,
      });
      const { accessToken } = useAuthStore.getState();
      if (!accessToken) {
        logger.warn("action_command.skipped_no_auth", { name: command.name });
        return;
      }
      const { show } = useActionCommandDialog.getState();
      handleQuickMatchNotice(command);
      handleOrderNotifyPopup(command, show);
      handleQuickMatchExpired(command, {
        notifyEnded: useQuickMatchEndSignals.getState().notifyEnded,
        dismissQuickMatchBar: (requestNo) => {
          actionNotice.dismiss(`qm:${requestNo}`);
        },
      });
    });
  }, []);

  return null;
}
