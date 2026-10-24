/**
 * 全局接待/代发相关融云命令监听：
 * - CUSTOMER_SERVICE_INVITE：接待邀请 → Alert 接单
 * - QUICK_MATCH_CREATED：接待代发创建 → 写入 quickMatchCreated 场景标记（不弹窗；是否显示「选择陪玩」由语聊房调 active/detail 决定）
 */
import { useAuthStore } from "@esports/auth";
import { useEffect } from "react";
import { Alert } from "react-native";
import Toast from "react-native-root-toast";

import { subscribeRongCommands } from "@/features/message/rongcloud-im";
import type { RongCommand } from "@/features/message/rongcloud-command";

import { claimAndEnterCustomerServiceRoom } from "../use-customer-service-room-flow";
import { useVoiceRoomSessionStore } from "../voice-room-session";

const PLATFORM_NOTICE_USER_ID = "50000000";
const CUSTOMER_SERVICE_INVITE = "CUSTOMER_SERVICE_INVITE";
const QUICK_MATCH_CREATED = "QUICK_MATCH_CREATED";

/** 邀请通知去重：roomId_roomVersion */
const csInviteKeys = new Set<string>();
/** 代发创建通知去重：requestNo */
const quickMatchCreatedKeys = new Set<string>();
/** 接单进行中 */
const claimingKeys = new Set<string>();

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
  if (Number.isFinite(expireAt) && expireAt * 1000 <= Date.now()) return;

  csInviteKeys.add(key);
  const playerName =
    stringField(command.data, "playerName") ||
    (stringField(command.data, "playerUserId")
      ? `玩家${stringField(command.data, "playerUserId")}`
      : "玩家");

  Alert.alert(
    "接待邀请",
    `玩家「${playerName}」正在呼叫接待，是否接单？`,
    [
      {
        text: "忽略",
        style: "cancel",
        onPress: () => {
          csInviteKeys.delete(key);
        },
      },
      {
        text: "接单",
        onPress: () => {
          void (async () => {
            if (claimingKeys.has(key)) return;
            claimingKeys.add(key);
            try {
              const result = await claimAndEnterCustomerServiceRoom({
                roomId,
                clubId,
                roomVersion,
              });
              if (result.status === "cancelled") {
                csInviteKeys.delete(key);
                return;
              }
              if (result.status === "failed") {
                csInviteKeys.delete(key);
                Toast.show(result.message, { duration: Toast.durations.SHORT });
                return;
              }
              Toast.show("接单成功，已进入房间", {
                duration: Toast.durations.SHORT,
              });
            } finally {
              claimingKeys.delete(key);
            }
          })();
        },
      },
    ],
    {
      cancelable: true,
      onDismiss: () => {
        csInviteKeys.delete(key);
      },
    },
  );
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
