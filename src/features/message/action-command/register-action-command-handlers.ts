/**
 * 操作型命令信令：
 * - QUICK_MATCH_NOTICE：快速匹配抢单通知 → 全局 ActionNotice 条
 * - ORDER_NOTIFY（RC:CmdMsg 支付催单信令）：支付催单 → ActionNotice 条（接单）
 * - QUICK_MATCH_EXPIRED / QUICK_MATCH_CANCELLED：终止信号（撤条 + 消费方结束会话）
 */
import { useQuickMatchEndSignals } from "@/features/match/quick-match-end-signals";
import { registerRongCommandHandler } from "@/features/message/rong-command-dispatch/rong-command-registry";
import { actionNotice } from "@/shared/ui/action-notice/action-notice-store";

import {
  handleOrderNotifyPopup,
  handleQuickMatchExpired,
  handleQuickMatchNotice,
} from "./action-command-handlers";

export function registerActionCommandHandlers(): () => void {
  return registerRongCommandHandler({
    id: "action-command",
    handle(command) {
      handleQuickMatchNotice(command);
      handleOrderNotifyPopup(command);
      handleQuickMatchExpired(command, {
        notifyEnded: useQuickMatchEndSignals.getState().notifyEnded,
        dismissQuickMatchBar: (requestNo) => {
          actionNotice.dismiss(`qm:${requestNo}`);
        },
      });
    },
  });
}
