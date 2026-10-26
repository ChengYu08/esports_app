/**
 * 接待邀请底部条（CUSTOMER_SERVICE_INVITE）：视觉与到期自消失由通用 ActionNoticeBar 承载，
 * 本组件只绑定接待业务（抢单切房流程、接单状态持久化、去重键释放）
 */
import { useState } from "react";
import Toast from "react-native-root-toast";

import { ActionNoticeBar } from "@/shared/ui/ActionNoticeBar";
import { markCsInviteClaimed, markCsInviteUnclaimed } from "@/features/message/cs-invite-claim-state";
import { claimAndEnterCustomerServiceRoom } from "../use-customer-service-room-flow";
import { useCsInviteBar } from "../cs-invite-bar-store";
import { releaseCsInviteKey } from "./ReceptionCommandListener";

const TRADE_NOTICE_ICON = require("../../../../assets/svgs/cs-invite-trade-notice.svg");
const MAX_BAR_DURATION_MS = 15000;

export function CustomerServiceInviteBar({ visible }: { visible?: boolean }) {
  const invite = useCsInviteBar((state) => state.invite);
  const dismiss = useCsInviteBar((state) => state.dismiss);
  const [claiming, setClaiming] = useState(false);

  if (!invite) return null;

  const playerName = invite.playerName
    || (invite.playerUserId ? `玩家${invite.playerUserId}` : "玩家");

  const handleGrab = async () => {
    if (claiming) return;
    setClaiming(true);
    try {
      const result = await claimAndEnterCustomerServiceRoom({
        roomId: invite.roomId,
        clubId: invite.clubId,
        roomVersion: invite.roomVersion,
      });
      if (result.status === "cancelled") return;
      if (result.status === "failed") {
        markCsInviteUnclaimed(invite.roomId, invite.roomVersion, invite.expireAt);
        Toast.show(result.message, { duration: Toast.durations.SHORT });
        return;
      }
      markCsInviteClaimed(invite.roomId, invite.roomVersion, invite.expireAt, false);
      dismiss();
    } finally {
      setClaiming(false);
    }
  };

  return (
    <ActionNoticeBar
      key={invite.key}
      visible={visible}
      text={`${playerName} 请求接待`}
      actionText="去抢单"
      icon={TRADE_NOTICE_ICON}
      claiming={claiming}
      onPressAction={() => {
        void handleGrab();
      }}
      expireAt={invite.expireAt * 1000}
      maxDurationMs={MAX_BAR_DURATION_MS}
      onDismiss={dismiss}
      onDisappear={() => releaseCsInviteKey(invite.key)}
    />
  );
}
