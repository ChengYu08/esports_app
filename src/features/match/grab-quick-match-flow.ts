/**
 * 快速匹配抢单流程（对齐 PC useQuickMatchRoomFlow）：
 * 抢单 → 异常回查详情（GRABBED 视为成功）→ ensure 试音房 → 需要时切房确认 → 进试音房
 */
import { useAuthStore } from "@esports/auth";
import { router } from "expo-router";
import Toast from "react-native-root-toast";

import { useAppConfirm } from "@/shared/ui/app-confirm";
import { fetchDispatchDetail, grabDispatchRequest } from "@/features/order/dispatch.api";
import { ensureAuditionRoom } from "@/features/match/api/match.api";
import { exitVoiceRoom } from "@/features/voice-room/exit-voice-room";
import { resolveVoiceRoomId, voiceRoomApi } from "@/features/voice-room/voice-room.api";
import type { VoiceRoomDetail } from "@/features/voice-room/voice-room.types";

export type QuickMatchGrabFlowResult =
  | { status: "entered" }
  | { status: "detail" }
  | { status: "cancelled" }
  | { status: "failed"; message: string };

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

async function grabWithFallback(requestNo: string, token: string) {
  try {
    await grabDispatchRequest(requestNo, token);
  } catch (error) {
    // 网络异常时回查详情，已抢上（GRABBED）视为成功（对齐 PC）
    try {
      const detail = await fetchDispatchDetail(requestNo, token);
      if (detail.currentGrabStatus === "GRABBED") return;
    } catch {
      // 详情也失败则抛出原始抢单错误
    }
    throw error;
  }
}

function confirmAuditionRoomSwitch(current: VoiceRoomDetail): Promise<boolean> {
  const selfId = String(useAuthStore.getState().user?.id || "");
  const isOwner = String(current.creatorUserId ?? "") === selfId;
  const roomName = current.roomName || "当前房间";

  return useAppConfirm.getState().confirm({
    title: "切换语聊房",
    message: `你当前正在「${roomName}」中。${isOwner ? "你是该房间的房主。" : ""}${isOwner
      ? "解散当前房间，房内所有成员都会被移出，然后进入试音房。"
      : "退出当前房间并进入试音房，其他成员不受影响。"}`,
    cancelText: "暂不处理",
    confirmText: "继续进入",
  });
}

export async function grabQuickMatchAndEnterAudition(
  requestNo: string,
): Promise<QuickMatchGrabFlowResult> {
  const { accessToken } = useAuthStore.getState();
  if (!accessToken) return { status: "failed", message: "请先登录" };

  try {
    await grabWithFallback(requestNo, accessToken);
  } catch (error) {
    return { status: "failed", message: errorMessage(error, "抢单失败，请稍后重试") };
  }

  let audition: Awaited<ReturnType<typeof ensureAuditionRoom>> | null = null;
  try {
    audition = await ensureAuditionRoom(requestNo, accessToken);
  } catch {
    audition = null;
  }
  if (!audition?.id) {
    // 无试音房：落到派单详情页（已有「已抢单等待老板选择」状态）
    router.push({
      pathname: "/order/dispatch/[requestNo]",
      params: { requestNo },
    });
    return { status: "detail" };
  }

  const targetId = audition.id;
  const targetVersion = audition.roomVersion != null ? String(audition.roomVersion) : "";

  try {
    const current = await voiceRoomApi.getJoinedRoom(accessToken);
    if (current) {
      const currentId = resolveVoiceRoomId(current) || String(current.id ?? "");
      const sameRoom =
        currentId === targetId && String(current.roomVersion ?? "") === targetVersion;
      if (!sameRoom) {
        const selfId = String(useAuthStore.getState().user?.id || "");
        if (String(current.serviceUserId ?? "") === selfId) {
          Toast.show("你正在当前房间接待，请先结束当前接待后再进房", {
            duration: Toast.durations.SHORT,
          });
          return { status: "cancelled" };
        }
        if (!(await confirmAuditionRoomSwitch(current))) {
          Toast.show("抢单成功", { duration: Toast.durations.SHORT });
          return { status: "cancelled" };
        }
        await exitVoiceRoom(
          {
            roomId: currentId,
            roomVersion: current.roomVersion ?? "1",
            creatorUserId: current.creatorUserId,
            rongChatroomId: current.rongChatroomId,
          },
          selfId,
          accessToken,
        );
      }
    }
  } catch (error) {
    return {
      status: "failed",
      message: errorMessage(error, "暂时无法进入试音房，请稍后重试"),
    };
  }

  router.push({
    pathname: "/voice-room/[id]",
    params: targetVersion ? { id: targetId, v: targetVersion } : { id: targetId },
  });
  return { status: "entered" };
}
