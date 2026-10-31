import { useAuthStore } from "@esports/auth";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { showToast } from "@/shared/ui/app-toast";

import {
  cancelQuickMatch,
  ensureAuditionRoom,
  fetchActiveQuickMatch,
  fetchQuickMatchDetail,
  fetchQuickMatchGames,
  fetchQuickMatchGrabList,
} from "@/features/match/api/match.api";
import {
  isQuickMatchActive,
  type QuickMatchGrabItem,
  type QuickMatchRequestDetail,
} from "@/features/match/api/match.types";
import { quickMatchGamesQueryKey } from "@/features/match/hooks/use-match-form";
import { useQuickMatchEndSignals } from "@/features/match/quick-match-end-signals";
import { parseServerDateTime } from "@/shared/time/server-date";
import { exitVoiceRoom } from "@/features/voice-room/exit-voice-room";
import { resolveVoiceRoomId } from "@/features/voice-room/voice-room.api";
import { useVoiceRoomSessionStore } from "@/features/voice-room/voice-room-session";

const POLL_INTERVAL_MS = 4000;
const DEFAULT_COUNTDOWN_SEC = 30 * 60;
/** 抢单选人上限（与 PC / 后端 @Size(max = 3) 一致） */
export const MAX_GRAB_SELECT = 3;

export type MatchEndReason = "expired" | "cancelled" | "ended";

function formatCountdown(sec: number): string {
  const safe = Math.max(0, sec);
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function resolveExpireAtMs(expireTime?: string): number {
  const serverExpireAt = parseServerDateTime(expireTime);
  if (Number.isFinite(serverExpireAt)) return serverExpireAt;
  return Date.now() + DEFAULT_COUNTDOWN_SEC * 1000;
}

/** 发布页：若有进行中需求则恢复到抢单中页（不自动进试音房，对齐 PC） */
export function useRestoreActiveMatch() {
  const token = useAuthStore((state) => state.accessToken);
  const queryClient = useQueryClient();
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function restore() {
      if (!token) {
        setRestoring(false);
        return;
      }
      try {
        const active = await fetchActiveQuickMatch(token);
        if (cancelled) return;
        if (active && isQuickMatchActive(active)) {
          let gamePayload: { id: string; name: string; iconUrl?: string } | null =
            null;
          try {
            if (active.gameId) {
              const games = await queryClient.fetchQuery({
                queryKey: quickMatchGamesQueryKey(token),
                queryFn: ({ signal }) => fetchQuickMatchGames(token, signal),
              });
              if (cancelled) return;
              const matched = games.find((g) => g.id === active.gameId);
              if (matched) {
                gamePayload = {
                  id: matched.id,
                  name: matched.name,
                  iconUrl: matched.iconUrl,
                };
              }
            }
          } catch {
            // 游戏信息缺失不影响进入匹配中
          }
          if (!gamePayload && active.gameId && active.gameName) {
            gamePayload = {
              id: String(active.gameId),
              name: active.gameName,
            };
          }
          const matchParams = {
            requestNo: active.requestNo,
            ...(active.expireTime ? { expireTime: active.expireTime } : {}),
            ...(gamePayload
              ? {
                  gameId: gamePayload.id,
                  gameName: gamePayload.name,
                  ...(gamePayload.iconUrl
                    ? { gameIconUrl: gamePayload.iconUrl }
                    : {}),
                }
              : {}),
          };
          router.replace({
            pathname: "/match/matching/[requestNo]",
            params: matchParams,
          });
          return;
        }
      } catch {
        // 恢复失败不影响表单
      } finally {
        if (!cancelled) setRestoring(false);
      }
    }
    void restore();
    return () => {
      cancelled = true;
    };
  }, [queryClient, token]);

  return { restoring };
}

type UseQuickMatchSessionOptions = {
  expireTime?: string;
  onEnded?: (reason: MatchEndReason) => void;
};

/** 关闭关联试音房；调用方负责 catch */
async function closeAuditionRoomIfNeeded(
  requestNo: string,
  token: string,
  userId: string,
  needVoice: boolean,
): Promise<void> {
  const activeRoom = useVoiceRoomSessionStore.getState().activeRoom;
  const auditionFromSession =
    activeRoom?.scene === "audition" && activeRoom.matchRequestNo === requestNo
      ? activeRoom
      : null;
  if (!needVoice && !auditionFromSession) return;

  let roomToExit: {
    roomId: string;
    roomVersion: string | number;
    creatorUserId?: string | number;
    rongChatroomId?: string;
  } | null = auditionFromSession
    ? {
        roomId: auditionFromSession.roomId,
        roomVersion: auditionFromSession.roomVersion,
        creatorUserId: auditionFromSession.creatorUserId,
        rongChatroomId: auditionFromSession.rongChatroomId,
      }
    : null;

  if (!roomToExit) {
    const room = await ensureAuditionRoom(requestNo, token);
    const roomId = resolveVoiceRoomId(room) || room.id;
    if (!roomId) return;
    roomToExit = {
      roomId,
      roomVersion: room.roomVersion ?? "1",
      creatorUserId: room.creatorUserId ?? userId,
    };
  }

  await exitVoiceRoom(roomToExit, userId, token);
}

/** 匹配中页：按路由 requestNo 轮询抢单列表 */
export function useQuickMatchSession(
  requestNo: string,
  options: UseQuickMatchSessionOptions = {},
) {
  const token = useAuthStore((state) => state.accessToken);
  const userId = useAuthStore((state) => state.user?.id);
  const { expireTime, onEnded } = options;

  const [detail, setDetail] = useState<QuickMatchRequestDetail | null>(null);
  const [candidates, setCandidates] = useState<QuickMatchGrabItem[]>([]);
  const [selectedGrabIds, setSelectedGrabIds] = useState<string[]>([]);
  const [countdownSec, setCountdownSec] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  /** 最近一次轮询中新出现的候选人 id（一次性的金色描边提示） */
  const [newCandidateIds, setNewCandidateIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  /** 建单后支付中：迟到的超时/结束信令不得清会话 */
  const [orderPending, setOrderPending] = useState(false);

  const expireAtRef = useRef(0);
  const generationRef = useRef(0);
  const pollBusyRef = useRef(false);
  const requestNoRef = useRef(requestNo);
  const orderPendingRef = useRef(false);
  const onEndedRef = useRef(onEnded);
  const endedRef = useRef(false);
  const detailRef = useRef<QuickMatchRequestDetail | null>(null);
  /** 上一次轮询的候选人 id，用于 diff 出新出现的 */
  const prevGrabIdsRef = useRef<Set<string>>(new Set());
  /** 清「新陪玩」标记的延时器，切换 requestNo/支付时取消 */
  const clearNewMarkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    requestNoRef.current = requestNo;
  }, [requestNo]);

  useEffect(() => {
    orderPendingRef.current = orderPending;
  }, [orderPending]);

  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  useEffect(() => {
    detailRef.current = detail;
  }, [detail]);

  const finishEnded = useCallback((reason: MatchEndReason, message?: string) => {
    if (orderPendingRef.current || endedRef.current) return;
    endedRef.current = true;
    generationRef.current += 1;
    if (reason === "cancelled") {
      showToast(message || "派单已取消");
    } else if (reason === "expired") {
      showToast(message || "派单已超时自动取消");
    } else {
      showToast(message || "该派单已结束");
    }
    onEndedRef.current?.(reason);
  }, []);

  const endMatching = useCallback(
    async (reason: MatchEndReason, message?: string) => {
      if (orderPendingRef.current || endedRef.current) return;
      // TODO(临时注释): 取消/超时关闭试音房
      // if (
      //   (reason === "cancelled" || reason === "expired") &&
      //   token &&
      //   userId
      // ) {
      //   try {
      //     await closeAuditionRoomIfNeeded(
      //       requestNoRef.current,
      //       token,
      //       String(userId),
      //       Boolean(detailRef.current?.needVoice),
      //     );
      //   } catch (error) {
      //     console.warn("[match] close audition room on end failed", error);
      //   }
      // }
      finishEnded(reason, message);
    },
    [finishEnded],
  );

  // 初始化倒计时
  useEffect(() => {
    endedRef.current = false;
    generationRef.current += 1;
    expireAtRef.current = resolveExpireAtMs(expireTime);
    const sec = Math.max(0, Math.floor((expireAtRef.current - Date.now()) / 1000));
    setCountdownSec(sec);
    setCandidates([]);
    setSelectedGrabIds([]);
    setNewCandidateIds(new Set());
    setDetail(null);
    setOrderPending(false);
    prevGrabIdsRef.current = new Set();
    if (clearNewMarkTimerRef.current) {
      clearTimeout(clearNewMarkTimerRef.current);
      clearNewMarkTimerRef.current = null;
    }
    if (sec <= 0) {
      void endMatching("expired");
    }
  }, [endMatching, expireTime, requestNo]);

  const pollGrabList = useCallback(async () => {
    const no = requestNoRef.current;
    const tokenValue = token;
    if (!no || !tokenValue || pollBusyRef.current || orderPendingRef.current || endedRef.current) {
      return;
    }
    const generation = generationRef.current;
    pollBusyRef.current = true;
    try {
      const nextDetail = await fetchQuickMatchDetail(no, tokenValue);
      if (
        generation !== generationRef.current
        || requestNoRef.current !== no
        || orderPendingRef.current
        || endedRef.current
      ) {
        return;
      }
      setDetail(nextDetail);
      if (nextDetail.expireTime) {
        const nextExpire = parseServerDateTime(nextDetail.expireTime);
        if (Number.isFinite(nextExpire)) expireAtRef.current = nextExpire;
      }
      if (!isQuickMatchActive(nextDetail)) {
        if (nextDetail.status === "EXPIRED" || nextDetail.status === "MATCHING") {
          void endMatching("expired");
        } else {
          finishEnded("ended");
        }
        return;
      }
      const list = await fetchQuickMatchGrabList(no, tokenValue);
      if (
        generation !== generationRef.current
        || requestNoRef.current !== no
        || orderPendingRef.current
        || endedRef.current
      ) {
        return;
      }
      setCandidates(list);
      setSelectedGrabIds((prev) => prev.filter((id) => list.some((item) => item.id === id)));

      // diff 出本次新出现的候选人，触发一次性金色描边
      const prevIds = prevGrabIdsRef.current;
      const arrivedIds = list.filter((item) => !prevIds.has(item.id)).map((item) => item.id);
      prevGrabIdsRef.current = new Set(list.map((item) => item.id));
      if (clearNewMarkTimerRef.current) {
        clearTimeout(clearNewMarkTimerRef.current);
        clearNewMarkTimerRef.current = null;
      }
      if (arrivedIds.length > 0) {
        setNewCandidateIds(new Set(arrivedIds));
        clearNewMarkTimerRef.current = setTimeout(() => {
          clearNewMarkTimerRef.current = null;
          setNewCandidateIds(new Set());
        }, 1500);
      } else {
        setNewCandidateIds(new Set());
      }
    } catch {
      // 网络失败保留视图，等待下次轮询
    } finally {
      pollBusyRef.current = false;
    }
  }, [endMatching, finishEnded, token]);

  // 倒计时
  useEffect(() => {
    if (!requestNo || orderPending || endedRef.current) return;
    const timer = setInterval(() => {
      if (orderPendingRef.current || endedRef.current) return;
      const sec = Math.max(0, Math.floor((expireAtRef.current - Date.now()) / 1000));
      setCountdownSec(sec);
      if (sec <= 0) void endMatching("expired");
    }, 1000);
    return () => clearInterval(timer);
  }, [endMatching, orderPending, requestNo]);

  // 抢单轮询
  useEffect(() => {
    if (!requestNo || !token || orderPending) return;
    void pollGrabList();
    const timer = setInterval(() => {
      void pollGrabList();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [orderPending, pollGrabList, requestNo, token]);

  // 服务端超时/取消信令（QUICK_MATCH_EXPIRED / QUICK_MATCH_CANCELLED）
  useEffect(() => {
    if (!requestNo) return;
    const pendingSignal = useQuickMatchEndSignals.getState().consume(requestNo);
    if (pendingSignal && !orderPendingRef.current && !endedRef.current) {
      void endMatching(pendingSignal);
    }
    return useQuickMatchEndSignals.subscribe((state) => {
      const reason = state.signals[requestNo];
      if (!reason || orderPendingRef.current || endedRef.current) return;
      useQuickMatchEndSignals.getState().consume(requestNo);
      void endMatching(reason);
    });
  }, [endMatching, requestNo]);

  const cancelMatching = useCallback(async (): Promise<boolean> => {
    const no = requestNo;
    if (!no || !token || submitting) return false;
    setSubmitting(true);
    try {
      await cancelQuickMatch(no, token);
      await endMatching("cancelled", "已取消派单");
      return true;
    } catch (error) {
      showToast(error instanceof Error ? error.message : "取消派单失败，请稍后重试");
      void pollGrabList();
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [endMatching, pollGrabList, requestNo, submitting, token]);

  const closeAuditionRoom = useCallback(async () => {
    if (!token || !userId) return;
    try {
      await closeAuditionRoomIfNeeded(
        requestNo,
        token,
        String(userId),
        Boolean(detailRef.current?.needVoice),
      );
    } catch (error) {
      console.warn("[match] close audition room failed", error);
    }
  }, [requestNo, token, userId]);

  const toggleGrab = useCallback((grabId: string) => {
    setSelectedGrabIds((prev) => {
      if (prev.includes(grabId)) {
        return prev.filter((id) => id !== grabId);
      }
      if (prev.length >= MAX_GRAB_SELECT) {
        showToast("最多选择3名陪玩");
        return prev;
      }
      return [...prev, grabId];
    });
  }, []);

  return {
    requestNo,
    detail,
    candidates,
    newCandidateIds,
    selectedGrabIds,
    countdownSec,
    countdownText: formatCountdown(countdownSec),
    submitting,
    orderPending,
    setSubmitting,
    setOrderPending,
    cancelMatching,
    closeAuditionRoom,
    toggleGrab,
  };
}
