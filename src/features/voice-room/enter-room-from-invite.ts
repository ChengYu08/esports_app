/**
 * 私信语聊房邀请卡进房：始终查 joined/current；同 roomId 直进；其他房确认后 exit 再进。
 */
import { useAuthStore } from "@esports/auth";
import { router } from "expo-router";

import { useAppConfirm } from "@/shared/ui/app-confirm";
import { showToast } from "@/shared/ui/app-toast";

import { exitVoiceRoom } from "./exit-voice-room";
import { resolveVoiceRoomId, voiceRoomApi } from "./voice-room.api";
import type { VoiceRoomDetail } from "./voice-room.types";
import { useVoiceRoomSessionStore } from "./voice-room-session";

export type EnterRoomFromInviteResult =
  | { status: "cancelled" }
  | { status: "failed"; message: string }
  | { status: "entered" };

const pendingInviteKeys = new Set<string>();

function isSameRoomId(
  joined: VoiceRoomDetail | null | undefined,
  targetRoomId: string,
): boolean {
  if (!joined) return false;
  const joinedId = resolveVoiceRoomId(joined);
  return Boolean(joinedId) && joinedId === targetRoomId;
}

function confirmRoomSwitch(current: VoiceRoomDetail): Promise<boolean> {
  const selfId = String(useAuthStore.getState().user?.id || "");
  const isOwner = String(current.creatorUserId ?? "") === selfId;
  const roomName = current.roomName || "当前";
  const leaveAction = isOwner ? "解散" : "退出";

  return useAppConfirm.getState().confirm({
    title: "切换语聊房",
    message: `切换将${leaveAction}「${roomName}」并进入目标语聊房，是否继续？`,
    cancelText: "取消",
    confirmText: "进入",
  });
}

function canSwitchFromCurrentRoom(current: VoiceRoomDetail): boolean {
  const selfId = String(useAuthStore.getState().user?.id || "");
  if (String(current.serviceUserId ?? "") === selfId) {
    showToast("你正在当前房间接待，请先结束当前接待后再进入");
    return false;
  }
  return true;
}

async function leaveCurrentForInvite(
  current: VoiceRoomDetail,
  targetRoomId: string,
  token: string,
) {
  const latestCurrent = await voiceRoomApi.getJoinedRoom(token);
  if (isSameRoomId(latestCurrent, targetRoomId)) return;
  if (!latestCurrent) return;

  const expectedId = resolveVoiceRoomId(current);
  const latestId = resolveVoiceRoomId(latestCurrent);
  if (!expectedId || !latestId || latestId !== expectedId) {
    throw new Error("当前语聊房已发生变化，请确认后重试");
  }

  const sessionRoom = useVoiceRoomSessionStore.getState().activeRoom;
  const userId = String(useAuthStore.getState().user?.id || "");
  await exitVoiceRoom(
    {
      roomId: latestId,
      roomVersion: latestCurrent.roomVersion ?? sessionRoom?.roomVersion ?? "1",
      creatorUserId: latestCurrent.creatorUserId ?? sessionRoom?.creatorUserId,
      rongChatroomId:
        latestCurrent.rongChatroomId ?? sessionRoom?.rongChatroomId,
    },
    userId,
    token,
  );

  const remained = await voiceRoomApi.getJoinedRoom(token);
  if (remained && !isSameRoomId(remained, targetRoomId)) {
    throw new Error("暂时无法退出当前语聊房，请稍后重试");
  }
}

function navigateToInviteRoom(roomId: string, roomVersion: string) {
  router.push({
    pathname: "/voice-room/[id]",
    params: { id: roomId, v: roomVersion },
  });
}

export async function enterRoomFromInvite(
  roomId: string,
  roomVersion: string,
): Promise<EnterRoomFromInviteResult> {
  const key = `${roomId}_${roomVersion}`;
  if (pendingInviteKeys.has(key)) return { status: "cancelled" };
  pendingInviteKeys.add(key);

  try {
    const { accessToken } = useAuthStore.getState();
    if (!accessToken) {
      showToast("请先登录");
      return { status: "failed", message: "请先登录" };
    }
    if (!roomId) {
      showToast("房间信息不完整");
      return { status: "failed", message: "房间信息不完整" };
    }

    let joined: VoiceRoomDetail | null;
    try {
      joined = await voiceRoomApi.getJoinedRoom(accessToken);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "查询语聊房状态失败，请重试";
      showToast(message);
      return { status: "failed", message };
    }

    if (!joined || isSameRoomId(joined, roomId)) {
      navigateToInviteRoom(roomId, roomVersion);
      return { status: "entered" };
    }

    if (!canSwitchFromCurrentRoom(joined)) {
      return { status: "cancelled" };
    }
    if (!(await confirmRoomSwitch(joined))) {
      return { status: "cancelled" };
    }

    try {
      await leaveCurrentForInvite(joined, roomId, accessToken);
      navigateToInviteRoom(roomId, roomVersion);
      return { status: "entered" };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "暂时无法进入语聊房，请稍后重试";
      showToast(message);
      return { status: "failed", message };
    }
  } finally {
    pendingInviteKeys.delete(key);
  }
}
