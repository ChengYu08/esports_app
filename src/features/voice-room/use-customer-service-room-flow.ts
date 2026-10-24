/**
 * 客服接单后的安全切房协调流程（对齐 PC useCustomerServiceRoomFlow）
 */
import { useAuthStore } from "@esports/auth";
import { router } from "expo-router";
import Toast from "react-native-root-toast";

import { useAppConfirm } from "@/shared/ui/app-confirm";

import { exitVoiceRoom } from "./exit-voice-room";
import { resolveVoiceRoomId, voiceRoomApi } from "./voice-room.api";
import type { VoiceRoomDetail } from "./voice-room.types";
import { useVoiceRoomSessionStore } from "./voice-room-session";

export type CustomerServiceInviteParams = {
  roomId: string;
  clubId: string;
  roomVersion: string;
};

export type CustomerServiceRoomFlowResult =
  | { status: "cancelled" }
  | { status: "failed"; message: string }
  | { status: "entered" };

const pendingClaimKeys = new Set<string>();

function isSameRoom(
  left: { id?: string | number; roomId?: string; roomVersion?: string | number } | null | undefined,
  right: { id: string; roomVersion: string | number } | null | undefined,
) {
  if (!left || !right) return false;
  const leftId = resolveVoiceRoomId(left) || String(left.id ?? left.roomId ?? "");
  return leftId === right.id && String(left.roomVersion ?? "") === String(right.roomVersion);
}

function confirmRoomSwitch(current: VoiceRoomDetail, resumed: boolean): Promise<boolean> {
  const selfId = String(useAuthStore.getState().user?.id || "");
  const isOwner = String(current.creatorUserId ?? "") === selfId;
  const prefix = resumed ? "你已接单。继续后将" : "只有接单成功后才会";
  const consequence = isOwner
    ? "解散当前房间，房内所有成员都会被移出，然后进入老板的语聊房。"
    : "退出当前房间并进入老板的语聊房，其他成员不受影响。";
  const roomName = current.roomName || "当前房间";

  return useAppConfirm.getState().confirm({
    title: resumed ? "进入接待房间" : "切换语聊房并接单",
    message: `你当前正在「${roomName}」中。${isOwner ? "你是该房间的房主。" : ""}${prefix}${consequence}`,
    cancelText: "暂不处理",
    confirmText: resumed ? "继续进入" : "继续接单",
  });
}

async function canSwitchFromCurrentRoom(current: VoiceRoomDetail): Promise<boolean> {
  const selfId = String(useAuthStore.getState().user?.id || "");
  if (String(current.serviceUserId ?? "") === selfId) {
    Toast.show("你正在当前房间接待，请先结束当前接待后再抢单", {
      duration: Toast.durations.SHORT,
    });
    return false;
  }
  return true;
}

async function leaveExpectedRoom(
  expectedCurrent: VoiceRoomDetail | null,
  target: { id: string; roomVersion: string },
  token: string,
) {
  const latestCurrent = await voiceRoomApi.getJoinedRoom(token);
  if (isSameRoom(latestCurrent, target)) return;
  if (!latestCurrent) return;
  if (
    !expectedCurrent
    || !isSameRoom(latestCurrent, {
      id: resolveVoiceRoomId(expectedCurrent) || String(expectedCurrent.id ?? ""),
      roomVersion: expectedCurrent.roomVersion,
    })
  ) {
    throw new Error("当前语聊房已发生变化，请确认后重试");
  }

  const latestId = resolveVoiceRoomId(latestCurrent);
  if (!latestId) throw new Error("当前语聊房信息不完整");

  const sessionRoom = useVoiceRoomSessionStore.getState().activeRoom;
  const userId = String(useAuthStore.getState().user?.id || "");
  await exitVoiceRoom(
    {
      roomId: latestId,
      roomVersion: latestCurrent.roomVersion ?? sessionRoom?.roomVersion ?? "1",
      creatorUserId: latestCurrent.creatorUserId ?? sessionRoom?.creatorUserId,
      rongChatroomId: latestCurrent.rongChatroomId ?? sessionRoom?.rongChatroomId,
    },
    userId,
    token,
  );

  const remained = await voiceRoomApi.getJoinedRoom(token);
  if (remained && !isSameRoom(remained, target)) {
    throw new Error("暂时无法退出当前语聊房，请稍后重试");
  }
}

export async function claimAndEnterCustomerServiceRoom(
  params: CustomerServiceInviteParams,
  resumed = false,
): Promise<CustomerServiceRoomFlowResult> {
  const key = `${params.roomId}_${params.roomVersion}`;
  if (pendingClaimKeys.has(key)) return { status: "cancelled" };
  pendingClaimKeys.add(key);

  try {
    const { accessToken } = useAuthStore.getState();
    if (!accessToken) {
      return { status: "failed", message: "请先登录" };
    }

    const current = await voiceRoomApi.getJoinedRoom(accessToken);
    const targetRef = { id: params.roomId, roomVersion: params.roomVersion };
    const expectedCurrent =
      current && !isSameRoom(current, targetRef) ? current : null;

    if (expectedCurrent) {
      if (!(await canSwitchFromCurrentRoom(expectedCurrent))) {
        return { status: "cancelled" };
      }
      if (!(await confirmRoomSwitch(expectedCurrent, resumed))) {
        return { status: "cancelled" };
      }
    }

    let claimed: { roomInfo?: VoiceRoomDetail } & VoiceRoomDetail;
    try {
      claimed = await voiceRoomApi.claimClubService(params, accessToken);
    } catch (error) {
      return {
        status: "failed",
        message: error instanceof Error ? error.message : "接单失败，请稍后重试",
      };
    }

    const target = claimed.roomInfo ?? claimed;
    const targetId = resolveVoiceRoomId(target) || params.roomId;
    const targetVersion = String(target.roomVersion ?? params.roomVersion);

    try {
      await leaveExpectedRoom(expectedCurrent, { id: targetId, roomVersion: targetVersion }, accessToken);
      router.push({
        pathname: "/voice-room/[id]",
        params: { id: targetId, v: targetVersion },
      });
      return { status: "entered" };
    } catch (error) {
      return {
        status: "failed",
        message:
          error instanceof Error
            ? error.message
            : "暂时无法进入老板的语聊房，请稍后重试",
      };
    }
  } catch (error) {
    return {
      status: "failed",
      message:
        error instanceof Error
          ? error.message
          : "暂时无法确认当前语聊房状态，请稍后重试",
    };
  } finally {
    pendingClaimKeys.delete(key);
  }
}
