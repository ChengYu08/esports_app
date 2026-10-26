/**
 * 快速匹配抢单通知条（QUICK_MATCH_NOTICE）：视觉与到期自消失由通用 ActionNoticeBar 承载，
 * 本组件只绑定抢单业务（grabQuickMatchAndEnterAudition 抢单进试音房、去重键释放）。
 * 与接待邀请条同时出现时在其上方错层展示
 */
import { useState } from "react";
import Toast from "react-native-root-toast";

import { ActionNoticeBar } from "@/shared/ui/ActionNoticeBar";
import { releaseQuickMatchNoticeKey } from "@/features/message/action-command/action-command-handlers";
import { grabQuickMatchAndEnterAudition } from "@/features/match/grab-quick-match-flow";
import { useQuickMatchNoticeBar } from "@/features/match/quick-match-invite-bar-store";
import { useCsInviteBar } from "@/features/voice-room/cs-invite-bar-store";

const TRADE_NOTICE_ICON = require("../../../../assets/svgs/cs-invite-trade-notice.svg");
const MAX_BAR_DURATION_MS = 30_000;
/** 接待条存在时上移一个条高，避免遮挡 */
const STACK_OFFSET = 56;

export function QuickMatchNoticeBar({ visible }: { visible?: boolean }) {
  const invite = useQuickMatchNoticeBar((state) => state.invite);
  const dismiss = useQuickMatchNoticeBar((state) => state.dismiss);
  const csInviteActive = useCsInviteBar((state) => Boolean(state.invite));
  const [claiming, setClaiming] = useState(false);

  if (!invite) return null;

  const handleGrab = async () => {
    if (claiming) return;
    setClaiming(true);
    try {
      const result = await grabQuickMatchAndEnterAudition(invite.requestNo);
      if (result.status === "failed") {
        Toast.show(result.message, { duration: Toast.durations.SHORT });
        return;
      }
      dismiss();
    } finally {
      setClaiming(false);
    }
  };

  return (
    <ActionNoticeBar
      key={invite.key}
      visible={visible}
      text={invite.text}
      actionText="去抢单"
      icon={TRADE_NOTICE_ICON}
      claiming={claiming}
      extraBottomOffset={csInviteActive ? STACK_OFFSET : 0}
      onPressAction={() => {
        void handleGrab();
      }}
      expireAt={invite.expireAt}
      maxDurationMs={MAX_BAR_DURATION_MS}
      onDismiss={dismiss}
      onDisappear={() => releaseQuickMatchNoticeKey(invite.requestNo)}
    />
  );
}
