/**
 * 俱乐部「接待派单」统一流程（对齐 PC useCustomerDispatch）
 *
 * 1. 不在任何语聊房 → 创建语聊房并自动呼叫接待；
 * 2. 已在语聊房 → 二次确认后退出/解散当前房间，再创建语聊房并自动呼叫接待。
 */
import { useAuthStore } from "@esports/auth";
import { router } from "expo-router";
import { useCallback, useRef } from "react";
import Toast from "react-native-root-toast";

import { useAppConfirm } from "@/shared/ui/app-confirm";

import { exitVoiceRoom } from "./exit-voice-room";
import { resolveVoiceRoomId, voiceRoomApi } from "./voice-room.api";
import { useVoiceRoomSessionStore } from "./voice-room-session";

export function useCustomerDispatch() {
  const dispatchingRef = useRef(false);

  const dispatch = useCallback(async (options?: { clubId?: string | number | null }) => {
    const { accessToken, user } = useAuthStore.getState();
    if (!accessToken) {
      Toast.show("请先登录", { duration: Toast.durations.SHORT });
      return;
    }
    if (dispatchingRef.current) return;
    dispatchingRef.current = true;

    try {
      const clubId = options?.clubId;
      const joined = await voiceRoomApi.getJoinedRoom(accessToken).catch(() => null);
      const joinedId = resolveVoiceRoomId(joined);

      if (joined && joinedId) {
        const confirmed = await confirmExitRoomForDispatch();
        if (!confirmed) return;

        const sessionRoom = useVoiceRoomSessionStore.getState().activeRoom;
        const roomToExit = {
          roomId: joinedId,
          roomVersion: joined.roomVersion ?? sessionRoom?.roomVersion ?? "1",
          creatorUserId: joined.creatorUserId ?? sessionRoom?.creatorUserId,
          rongChatroomId: joined.rongChatroomId ?? sessionRoom?.rongChatroomId,
        };
        await exitVoiceRoom(roomToExit, String(user?.id ?? ""), accessToken);
      }

      const nickname = user?.nickname || "我";
      const room = await voiceRoomApi.createRoom(
        `${nickname}的语音房`,
        accessToken,
        clubId != null && clubId !== "" ? clubId : undefined,
      );
      const roomId = resolveVoiceRoomId(room);
      if (!roomId) throw new Error("创建语聊房失败，请稍后重试");

      router.push({
        pathname: "/voice-room/[id]",
        params: {
          id: roomId,
          ...(room.roomVersion != null ? { v: String(room.roomVersion) } : {}),
          callService: "1",
        },
      });
    } catch (error) {
      Toast.show(
        error instanceof Error ? error.message : "接待派单失败，请稍后重试",
        { duration: Toast.durations.SHORT },
      );
    } finally {
      dispatchingRef.current = false;
    }
  }, []);

  return { dispatch };
}

function confirmExitRoomForDispatch(): Promise<boolean> {
  return useAppConfirm.getState().confirm({
    title: "提示",
    message: "已在语聊房中，客服派单需先退出或解散当前房间，是否继续",
    cancelText: "取消",
    confirmText: "继续",
  });
}
