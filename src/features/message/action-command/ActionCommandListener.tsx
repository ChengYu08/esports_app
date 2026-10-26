/**
 * 操作型命令信令监听：
 * - QUICK_MATCH_NOTICE：快速匹配抢单通知 → 底部通知条（QuickMatchNoticeBar，仅主 tab 可见）
 * - ORDER_NOTIFY（RC:CmdMsg 弹窗信令，仅支付事件）：支付催单弹窗（接单按钮）
 * - QUICK_MATCH_EXPIRED / QUICK_MATCH_CANCELLED：终止信号（撤条 + 消费方结束会话）
 */
import { useAuthStore } from "@esports/auth";
import { useEffect } from "react";

import { useQuickMatchEndSignals } from "@/features/match/quick-match-end-signals";
import { useQuickMatchNoticeBar } from "@/features/match/quick-match-invite-bar-store";
import { subscribeRongCommands } from "@/features/message/rongcloud-im";
import { useActionCommandDialog } from "./action-command-store";
import {
  handleOrderNotifyPopup,
  handleQuickMatchExpired,
  handleQuickMatchNotice,
} from "./action-command-handlers";

export function ActionCommandListener() {
  useEffect(() => {
    return subscribeRongCommands((command) => {
      const { accessToken } = useAuthStore.getState();
      if (!accessToken) return;
      const { show } = useActionCommandDialog.getState();
      handleQuickMatchNotice(command, useQuickMatchNoticeBar.getState().show);
      handleOrderNotifyPopup(command, show);
      handleQuickMatchExpired(command, {
        notifyEnded: useQuickMatchEndSignals.getState().notifyEnded,
        dismissQuickMatchBar: (requestNo) => {
          const bar = useQuickMatchNoticeBar.getState();
          if (bar.invite?.requestNo === requestNo) bar.dismiss();
        },
      });
    });
  }, []);

  return null;
}
