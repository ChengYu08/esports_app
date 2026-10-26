/**
 * 操作型命令信令：
 * - QUICK_MATCH_NOTICE：快速匹配抢单通知 → 全局 ActionNotice 条
 * - ORDER_NOTIFY（RC:CmdMsg 弹窗信令，仅支付事件）：支付催单弹窗（接单按钮）
 * - QUICK_MATCH_EXPIRED / QUICK_MATCH_CANCELLED：终止信号（撤条 + 消费方结束会话）
 */
import { useQuickMatchEndSignals } from "@/features/match/quick-match-end-signals";
import { registerRongCommandHandler } from "@/features/message/rong-command-dispatch/rong-command-registry";
import { actionNotice } from "@/shared/ui/action-notice/action-notice-store";

import { useActionCommandDialog } from "./action-command-store";
import {
  handleOrderNotifyPopup,
  handleQuickMatchExpired,
  handleQuickMatchNotice,
} from "./action-command-handlers";

export function registerActionCommandHandlers(): () => void {
  return registerRongCommandHandler({
    id: "action-command",
    handle(command) {
      const { show } = useActionCommandDialog.getState();
      handleQuickMatchNotice(command);
      handleOrderNotifyPopup(command, show);
      handleQuickMatchExpired(command, {
        notifyEnded: useQuickMatchEndSignals.getState().notifyEnded,
        dismissQuickMatchBar: (requestNo) => {
          actionNotice.dismiss(`qm:${requestNo}`);
        },
      });
    },
  });
}
