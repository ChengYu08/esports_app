/**
 * 全局接待/代发相关融云命令：
 * - CUSTOMER_SERVICE_INVITE：接待邀请 → 全局 ActionNotice 抢单条（到期自动消失）
 * - QUICK_MATCH_CREATED：接待代发创建 → 写入 quickMatchCreated 场景标记
 */
import { logger } from "@/core/logging/logger";
import { showToast } from "@/shared/ui/app-toast";

import { markCsInviteClaimed, markCsInviteUnclaimed } from "@/features/message/cs-invite-claim-state";
import type { RongCommand } from "@/features/message/rongcloud-command";
import { registerRongCommandHandler } from "@/features/message/rong-command-dispatch/rong-command-registry";
import { formatServerDateTime, parseServerDateTime } from "@/shared/time/server-date";
import { actionNotice } from "@/shared/ui/action-notice/action-notice-store";
import { TRADE_NOTICE_ICON } from "@/shared/ui/action-notice/trade-notice-icon";

import { claimAndEnterCustomerServiceRoom } from "./use-customer-service-room-flow";
import { useVoiceRoomSessionStore } from "./voice-room-session";

const PLATFORM_NOTICE_USER_ID = "50000000";
const CUSTOMER_SERVICE_INVITE = "CUSTOMER_SERVICE_INVITE";
const QUICK_MATCH_CREATED = "QUICK_MATCH_CREATED";
const MAX_BAR_DURATION_MS = 15_000;
/** 离线消息重放门控：命令通知比这更旧视为离线积压，不再处理（超过即为离线重放） */
const COMMAND_STALE_MAX_MS = 15 * 60_000;

/** 邀请通知去重：roomId_roomVersion（条到期后清除，允许同房间下一轮邀请再次提示） */
const csInviteKeys = new Map<string, number>();
/** 代发创建通知去重：requestNo */
const quickMatchCreatedKeys = new Set<string>();

function stringField(data: Record<string, unknown>, key: string): string {
  const value = data[key];
  if (value == null) return "";
  return String(value);
}

export function handleCustomerServiceInvite(command: RongCommand) {
  if (command.name !== CUSTOMER_SERVICE_INVITE) return;

  const roomId = stringField(command.data, "roomId");
  const clubId = stringField(command.data, "clubId");
  const roomVersion = stringField(command.data, "roomVersion");
  if (!roomId || !clubId || !roomVersion) {
    logger.warn("cs_invite.dropped_missing_fields", {
      roomId,
      clubId,
      roomVersion,
    });
    return;
  }

  const key = `${roomId}_${roomVersion}`;
  if (csInviteKeys.has(key)) {
    logger.info("cs_invite.dropped_dedup", { roomId, roomVersion });
    return;
  }

  const expireAtSec = Number(command.data.expireAt);
  if (!Number.isFinite(expireAtSec)) {
    logger.warn("cs_invite.dropped_invalid_expire_at", {
      roomId,
      roomVersion,
      expireAt: stringField(command.data, "expireAt"),
    });
    return;
  }
  if (expireAtSec * 1000 <= Date.now()) {
    // 到达时已过期：多为离线/断连期间积压，或设备时钟偏差，需要留痕区分
    logger.warn("cs_invite.dropped_expired", {
      roomId,
      roomVersion,
      expireAtMs: expireAtSec * 1000,
      receivedAtMs: Date.now(),
      skewMs: Date.now() - expireAtSec * 1000,
    });
    return;
  }

  const playerUserId = stringField(command.data, "playerUserId");
  const playerName =
    stringField(command.data, "playerName")
    || (playerUserId ? `玩家${playerUserId}` : "玩家");
  const noticeId = `cs:${key}`;

  logger.info("cs_invite.received", {
    roomId,
    clubId,
    roomVersion,
    expireAtMs: expireAtSec * 1000,
    playerUserId,
  });
  csInviteKeys.set(key, expireAtSec);
  actionNotice.push(
    {
      id: noticeId,
      text: `${playerName} 请求接待`,
      actionText: "去抢单",
      icon: TRADE_NOTICE_ICON,
      expireAt: expireAtSec * 1000,
      maxDurationMs: MAX_BAR_DURATION_MS,
    },
    {
      onAction: async () => {
        const result = await claimAndEnterCustomerServiceRoom({
          roomId,
          clubId,
          roomVersion,
        });
        if (result.status === "cancelled") return;
        if (result.status === "failed") {
          markCsInviteUnclaimed(roomId, roomVersion, expireAtSec);
          showToast(result.message);
          return;
        }
        markCsInviteClaimed(roomId, roomVersion, expireAtSec, false);
        actionNotice.dismiss(noticeId);
      },
      onDisappear: () => releaseCsInviteKey(key),
    },
  );
}

export function handleQuickMatchCreated(command: RongCommand, now = Date.now()) {
  if (command.name !== QUICK_MATCH_CREATED) return;
  if (command.senderId !== PLATFORM_NOTICE_USER_ID) return;

  const requestNo = stringField(command.data, "requestNo");
  if (!requestNo) return;
  if (quickMatchCreatedKeys.has(requestNo)) return;

  const expireTime = stringField(command.data, "expireTime");
  const expireAtMs = parseServerDateTime(expireTime);
  const stale =
    command.sentTime != null && now - command.sentTime > COMMAND_STALE_MAX_MS;
  const expired = Number.isFinite(expireAtMs) && expireAtMs - now <= 0;
  if (stale || expired) {
    // 长时间未登录重连会整批重放旧命令，过期/离线重放的代发创建不再标记场景
    logger.warn("quick_match_created.stale_dropped", {
      requestNo,
      stale,
      expired,
      expireTime: expireTime || undefined,
      expireAtMs: Number.isFinite(expireAtMs) ? expireAtMs : undefined,
      sentTime:
        command.sentTime != null
          ? formatServerDateTime(command.sentTime)
          : undefined,
      skewMs: command.sentTime != null ? now - command.sentTime : undefined,
    });
    return;
  }
  quickMatchCreatedKeys.add(requestNo);

  const activeRoom = useVoiceRoomSessionStore.getState().activeRoom;
  if (!activeRoom) return;

  // 只写 quickMatchCreated 场景；是否显示「选择陪玩」由 VoiceRoomScreen 调 fetchActiveQuickMatch 决定
  useVoiceRoomSessionStore.getState().setActiveRoom({
    ...activeRoom,
    scene: "quickMatchCreated",
    matchRequestNo: requestNo,
    ...(expireTime ? { matchExpireTime: expireTime } : {}),
  });
}

/** 抢单条消失（到期/接单成功）时释放去重键，允许下一轮邀请再次提示 */
export function releaseCsInviteKey(key: string) {
  csInviteKeys.delete(key);
}

export function registerReceptionCommandHandlers(): () => void {
  return registerRongCommandHandler({
    id: "reception-command",
    handle(command) {
      handleCustomerServiceInvite(command);
      handleQuickMatchCreated(command);
    },
  });
}
