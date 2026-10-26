/**
 * 全局接待/代发相关融云命令监听：
 * - CUSTOMER_SERVICE_INVITE：接待邀请 → 底部抢单条（CustomerServiceInviteBar，到期自动消失）
 * - QUICK_MATCH_CREATED：接待代发创建 → 写入 quickMatchCreated 场景标记（不弹窗；是否显示「选择陪玩」由语聊房调 active/detail 决定）
 */
import { useAuthStore } from "@esports/auth";
import { useEffect } from "react";

import { subscribeRongCommands } from "@/features/message/rongcloud-im";
import type { RongCommand } from "@/features/message/rongcloud-command";

import { useCsInviteBar } from "../cs-invite-bar-store";
import { useVoiceRoomSessionStore } from "../voice-room-session";

const PLATFORM_NOTICE_USER_ID = "50000000";
const CUSTOMER_SERVICE_INVITE = "CUSTOMER_SERVICE_INVITE";
const QUICK_MATCH_CREATED = "QUICK_MATCH_CREATED";

/** 邀请通知去重：roomId_roomVersion（条到期后清除，允许同房间下一轮邀请再次提示） */
const csInviteKeys = new Map<string, number>();
/** 代发创建通知去重：requestNo */
const quickMatchCreatedKeys = new Set<string>();

function stringField(data: Record<string, unknown>, key: string): string {
  const value = data[key];
  if (value == null) return "";
  return String(value);
}

function handleCustomerServiceInvite(command: RongCommand) {
  if (command.name !== CUSTOMER_SERVICE_INVITE) return;

  const roomId = stringField(command.data, "roomId");
  const clubId = stringField(command.data, "clubId");
  const roomVersion = stringField(command.data, "roomVersion");
  if (!roomId || !clubId || !roomVersion) return;

  const key = `${roomId}_${roomVersion}`;
  if (csInviteKeys.has(key)) return;

  const expireAt = Number(command.data.expireAt);
  if (!Number.isFinite(expireAt)) return;
  if (expireAt * 1000 <= Date.now()) return;

  csInviteKeys.set(key, expireAt);
  useCsInviteBar.getState().show({
    key,
    roomId,
    clubId,
    roomVersion,
    playerUserId: stringField(command.data, "playerUserId"),
    playerName: stringField(command.data, "playerName"),
    expireAt,
  });
}

function handleQuickMatchCreated(command: RongCommand) {
  if (command.name !== QUICK_MATCH_CREATED) return;
  if (command.senderId !== PLATFORM_NOTICE_USER_ID) return;

  const requestNo = stringField(command.data, "requestNo");
  if (!requestNo) return;
  if (quickMatchCreatedKeys.has(requestNo)) return;
  quickMatchCreatedKeys.add(requestNo);

  const expireTime = stringField(command.data, "expireTime");
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

export function ReceptionCommandListener() {
  useEffect(() => {
    return subscribeRongCommands((command) => {
      const { accessToken } = useAuthStore.getState();
      if (!accessToken) return;
      handleCustomerServiceInvite(command);
      handleQuickMatchCreated(command);
    });
  }, []);

  return null;
}
