import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

import { showToast } from "@/shared/ui/app-toast";

import { voiceRoomApi } from "./voice-room.api";
import type { VoiceRoomDetail } from "./voice-room.types";

/** 呼叫接待超时（秒），对齐 PC CS_CALL_TIMEOUT_SECONDS */
const CS_CALL_TIMEOUT_SECONDS = 60;

export interface UseCustomerServiceCallOptions {
  roomId: string | undefined;
  accessToken: string | null;
  room: VoiceRoomDetail | null;
  isOwner: boolean;
  rtcReady: boolean;
  loading: boolean;
  shouldAutoCallService: boolean;
  setRoom: Dispatch<SetStateAction<VoiceRoomDetail | null>>;
}

export function useCustomerServiceCall(options: UseCustomerServiceCallOptions) {
  const {
    roomId,
    accessToken,
    room,
    isOwner,
    rtcReady,
    loading,
    shouldAutoCallService,
    setRoom,
  } = options;
  const roomVersion = room?.roomVersion ?? "1";
  const [serviceCalling, setServiceCalling] = useState(false);
  const autoCallServiceDoneRef = useRef(false);
  const csTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCsTimeout = useCallback(() => {
    if (csTimeoutRef.current) {
      clearTimeout(csTimeoutRef.current);
      csTimeoutRef.current = null;
    }
  }, []);

  const startCsTimeout = useCallback(() => {
    clearCsTimeout();
    csTimeoutRef.current = setTimeout(() => {
      csTimeoutRef.current = null;
      setServiceCalling((calling) => {
        if (calling) {
          showToast("当前无空闲接待，请稍后再试");
        }
        return false;
      });
    }, CS_CALL_TIMEOUT_SECONDS * 1000);
  }, [clearCsTimeout]);

  const callService = useCallback(async () => {
    if (!roomId || !accessToken || serviceCalling) return;
    if (!room?.clubId) {
      showToast("当前房间暂未绑定俱乐部，无法呼叫接待");
      return;
    }
    if (room.serviceUserId) return;
    setServiceCalling(true);
    startCsTimeout();
    try {
      await voiceRoomApi.inviteClubService(
        roomId,
        roomVersion,
        room.clubId,
        accessToken,
      );
      showToast("已呼叫俱乐部接待，请稍候");
    } catch (cause) {
      clearCsTimeout();
      setServiceCalling(false);
      showToast(
        cause instanceof Error ? cause.message : "呼叫接待失败，请稍后重试",
      );
    }
  }, [
    accessToken,
    clearCsTimeout,
    room?.clubId,
    room?.serviceUserId,
    roomId,
    roomVersion,
    serviceCalling,
    startCsTimeout,
  ]);

  /** 俱乐部接待派单进房后自动呼叫接待（仅一次） */
  useEffect(() => {
    if (!shouldAutoCallService || autoCallServiceDoneRef.current) return;
    if (!roomId || !accessToken || loading || !room || !rtcReady) return;
    if (!isOwner || room.serviceUserId) {
      autoCallServiceDoneRef.current = true;
      return;
    }
    autoCallServiceDoneRef.current = true;
    void callService();
  }, [
    accessToken,
    callService,
    isOwner,
    loading,
    room,
    roomId,
    rtcReady,
    shouldAutoCallService,
  ]);

  useEffect(() => () => clearCsTimeout(), [clearCsTimeout]);

  /** 呼叫中成员加入时反查 serviceUserId，确认接待是否已接单 */
  const refreshServiceUserId = useCallback(
    async (joinedUserId?: string) => {
      if (!roomId || !accessToken) return;
      try {
        const detail = await voiceRoomApi.getDetail(roomId, accessToken);
        const serviceUserId =
          detail.serviceUserId == null ? "" : String(detail.serviceUserId);
        setRoom((prev) =>
          prev
            ? {
                ...prev,
                serviceUserId: detail.serviceUserId ?? prev.serviceUserId,
                clubId: detail.clubId ?? prev.clubId,
              }
            : prev,
        );
        if (
          serviceCalling &&
          serviceUserId &&
          (!joinedUserId || serviceUserId === joinedUserId)
        ) {
          clearCsTimeout();
          setServiceCalling(false);
          showToast("接待已接单");
        }
      } catch {
        /* 反查失败静默，等下一次成员变更或超时兜底 */
      }
    },
    [accessToken, clearCsTimeout, roomId, serviceCalling, setRoom],
  );

  return { serviceCalling, callService, refreshServiceUserId };
}
