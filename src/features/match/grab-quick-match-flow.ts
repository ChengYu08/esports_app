/**
 * 快速匹配抢单流程（对齐 PC useQuickMatchRoomFlow.grabAndEnterAuditionRoom）：
 * 预取详情 → 有试音房则抢单前确认切房 → grab → 无试音只 Toast；有试音再切房进入
 */
import { useAuthStore } from "@esports/auth";
import { router } from "expo-router";
import { showToast } from "@/shared/ui/app-toast";

import { fetchActiveQuickMatch } from "@/features/match/api/match.api";
import {
  type DispatchRequest,
  fetchDispatchDetail,
  grabDispatchRequest,
} from "@/features/order/dispatch.api";
import { useAppConfirm } from "@/shared/ui/app-confirm";
import { exitVoiceRoom } from "@/features/voice-room/exit-voice-room";
import { resolveVoiceRoomId, voiceRoomApi } from "@/features/voice-room/voice-room.api";
import type { VoiceRoomDetail } from "@/features/voice-room/voice-room.types";
import { useVoiceRoomSessionStore } from "@/features/voice-room/voice-room-session";

export type QuickMatchGrabFlowResult =
  | { status: "entered" }
  | { status: "grabbed" }
  | { status: "cancelled" }
  | { status: "failed"; message: string };

/** 模块级防重：IM 通知与派单中心共享，避免同一需求重复提交 */
const pendingRequestNos = new Set<string>();

export function hasAuditionRoom(
  request: Pick<DispatchRequest, "needVoice" | "roomId" | "roomVersion"> | null | undefined,
): boolean {
  return !!request?.needVoice && request.roomId != null && request.roomVersion != null;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function isSameRoom(
  left: { id?: string | number; roomId?: string; roomVersion?: string | number } | null | undefined,
  right: { id: string; roomVersion: string | number } | null | undefined,
) {
  if (!left || !right) return false;
  const leftId = resolveVoiceRoomId(left) || String(left.id ?? left.roomId ?? "");
  return leftId === right.id && String(left.roomVersion ?? "") === String(right.roomVersion);
}

async function grabWithRecovery(requestNo: string, token: string): Promise<DispatchRequest> {
  try {
    return await grabDispatchRequest(requestNo, token);
  } catch (error) {
    try {
      const detail = await fetchDispatchDetail(requestNo, token);
      if (detail.currentGrabStatus === "GRABBED") return detail;
    } catch {
      // 回查失败时保留原始抢单异常
    }
    throw error;
  }
}

function confirmRoomSwitch(current: VoiceRoomDetail): Promise<boolean> {
  const selfId = String(useAuthStore.getState().user?.id || "");
  const isOwner = String(current.creatorUserId ?? "") === selfId;
  const roomName = current.roomName || "当前房间";
  const roleText = isOwner ? "你是该房间的房主。" : "";
  const consequence = isOwner
    ? "解散当前房间，房内其他用户也会被移出，然后进入老板的试音房。"
    : "退出当前房间并进入老板的试音房。";

  return useAppConfirm.getState().confirm({
    title: "切换语聊房并抢单",
    message: `你当前正在「${roomName}」语聊房中。${roleText}继续抢单后，只有抢单成功才会${consequence}`,
    cancelText: "暂不抢单",
    confirmText: "继续抢单",
  });
}

/** 房主不能解散仍在派单中的试音房（对齐 PC canSwitchFromCurrentRoom） */
async function canSwitchFromCurrentRoom(
  current: VoiceRoomDetail,
  token: string,
): Promise<boolean> {
  const selfId = String(useAuthStore.getState().user?.id || "");
  if (String(current.serviceUserId ?? "") === selfId) {
    showToast("你正在当前房间接待，请先结束当前接待后再抢单");
    return false;
  }
  if (String(current.creatorUserId ?? "") !== selfId) return true;

  try {
    const activeRequest = await fetchActiveQuickMatch(token);
    if (!activeRequest || activeRequest.status !== "MATCHING") return true;
    const currentId = resolveVoiceRoomId(current) || String(current.id ?? "");
    if (
      String(activeRequest.roomId || "") !== currentId
      || String(activeRequest.roomVersion || "") !== String(current.roomVersion ?? "")
    ) {
      return true;
    }
    showToast("当前语聊房关联了你正在进行的派单，请先取消该派单后再抢单");
    return false;
  } catch {
    return true;
  }
}

/**
 * 解析需求当前可进入的试音房；允许同一老板房间重开后的新版本（对齐 PC resolveAuditionRoom）
 */
async function resolveAuditionRoom(
  reference: Pick<DispatchRequest, "roomId" | "roomVersion" | "buyerUserId">,
  token: string,
  allowReopened: boolean,
): Promise<VoiceRoomDetail> {
  if (reference.roomId == null || reference.roomVersion == null) {
    throw new Error("试音房信息不存在");
  }
  const target = await voiceRoomApi.getDetail(String(reference.roomId), token);
  if (!target || target.roomStatus !== 1) throw new Error("试音房已关闭");
  if (String(target.roomVersion) !== String(reference.roomVersion)) {
    const belongsToBuyer =
      reference.buyerUserId != null
      && String(target.creatorUserId) === String(reference.buyerUserId);
    if (!allowReopened || !belongsToBuyer) {
      throw new Error("试音房已重新开启，请刷新后重试");
    }
  }
  return target;
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

async function switchToAuditionRoom(
  detail: DispatchRequest,
  expectedCurrent: VoiceRoomDetail | null,
  token: string,
): Promise<{ id: string; roomVersion: string }> {
  if (!hasAuditionRoom(detail)) throw new Error("试音房信息不存在");
  const target = await resolveAuditionRoom(detail, token, true);
  const targetId = resolveVoiceRoomId(target) || String(target.id ?? "");
  if (!targetId) throw new Error("试音房信息不存在");
  const targetVersion = String(target.roomVersion ?? detail.roomVersion ?? "");
  const targetRef = { id: targetId, roomVersion: targetVersion };

  await leaveExpectedRoom(expectedCurrent, targetRef, token);
  return targetRef;
}

/** 测试专用：清空防重集合 */
export function resetGrabQuickMatchPending() {
  pendingRequestNos.clear();
}

export async function grabQuickMatchAndEnterAudition(
  requestNo: string,
): Promise<QuickMatchGrabFlowResult> {
  if (pendingRequestNos.has(requestNo)) return { status: "cancelled" };
  pendingRequestNos.add(requestNo);

  let grabbed = false;
  try {
    const { accessToken } = useAuthStore.getState();
    if (!accessToken) return { status: "failed", message: "请先登录" };

    const request = await fetchDispatchDetail(requestNo, accessToken);
    let confirmedCurrent: VoiceRoomDetail | null = null;

    if (hasAuditionRoom(request)) {
      const target = await resolveAuditionRoom(request, accessToken, true);
      const targetId = resolveVoiceRoomId(target) || String(target.id ?? "");
      const targetRef = {
        id: targetId,
        roomVersion: String(target.roomVersion ?? request.roomVersion ?? ""),
      };
      const joined = await voiceRoomApi.getJoinedRoom(accessToken);
      if (joined && !isSameRoom(joined, targetRef)) {
        if (!(await canSwitchFromCurrentRoom(joined, accessToken))) {
          return { status: "cancelled" };
        }
        if (!(await confirmRoomSwitch(joined))) {
          return { status: "cancelled" };
        }
        confirmedCurrent = joined;
      }
    }

    const detail = await grabWithRecovery(requestNo, accessToken);
    grabbed = true;

    if (!hasAuditionRoom(detail)) {
      showToast("抢单成功");
      return { status: "grabbed" };
    }

    showToast("抢单成功，正在进入试音房…");
    const room = await switchToAuditionRoom(detail, confirmedCurrent, accessToken);
    router.push({
      pathname: "/voice-room/[id]",
      params: room.roomVersion
        ? { id: room.id, v: room.roomVersion }
        : { id: room.id },
    });
    return { status: "entered" };
  } catch (error) {
    if (grabbed) {
      showToast(
        error instanceof Error && error.message
          ? `抢单已成功，但${error.message}`
          : "抢单已成功，但暂时无法进入试音房，请从抢单记录重试",
      );
      return { status: "grabbed" };
    }
    return { status: "failed", message: errorMessage(error, "抢单失败，请稍后重试") };
  } finally {
    pendingRequestNos.delete(requestNo);
  }
}
