import { useAuthStore } from "@esports/auth";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import Toast from "react-native-root-toast";

import {
  cancelQuickMatch,
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
  const serverExpireAt = expireTime ? new Date(expireTime).getTime() : NaN;
  if (Number.isFinite(serverExpireAt)) return serverExpireAt;
  return Date.now() + DEFAULT_COUNTDOWN_SEC * 1000;
}

/** 发布页：若有进行中需求则 replace 到匹配中页 */
export function useRestoreActiveMatch() {
  const token = useAuthStore((state) => state.accessToken);
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
              const games = await fetchQuickMatchGames(token);
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
          router.replace({
            pathname: "/match/matching/[requestNo]",
            params: {
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
            },
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
  }, [token]);

  return { restoring };
}

type UseQuickMatchSessionOptions = {
  expireTime?: string;
  onEnded?: (reason: MatchEndReason) => void;
};

/** 匹配中页：按路由 requestNo 轮询抢单列表 */
export function useQuickMatchSession(
  requestNo: string,
  options: UseQuickMatchSessionOptions = {},
) {
  const token = useAuthStore((state) => state.accessToken);
  const { expireTime, onEnded } = options;

  const [detail, setDetail] = useState<QuickMatchRequestDetail | null>(null);
  const [candidates, setCandidates] = useState<QuickMatchGrabItem[]>([]);
  const [selectedGrabIds, setSelectedGrabIds] = useState<string[]>([]);
  const [countdownSec, setCountdownSec] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  /** 建单后支付中：迟到的超时/结束信令不得清会话 */
  const [orderPending, setOrderPending] = useState(false);

  const expireAtRef = useRef(0);
  const generationRef = useRef(0);
  const pollBusyRef = useRef(false);
  const requestNoRef = useRef(requestNo);
  const orderPendingRef = useRef(false);
  const onEndedRef = useRef(onEnded);
  const endedRef = useRef(false);

  useEffect(() => {
    requestNoRef.current = requestNo;
  }, [requestNo]);

  useEffect(() => {
    orderPendingRef.current = orderPending;
  }, [orderPending]);

  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  const finishEnded = useCallback((reason: MatchEndReason, message?: string) => {
    if (orderPendingRef.current || endedRef.current) return;
    endedRef.current = true;
    generationRef.current += 1;
    if (reason === "cancelled") {
      Toast.show(message || "派单已取消", { duration: Toast.durations.SHORT });
    } else if (reason === "expired") {
      Toast.show(message || "派单已超时自动取消", { duration: Toast.durations.SHORT });
    } else {
      Toast.show(message || "该派单已结束", { duration: Toast.durations.SHORT });
    }
    onEndedRef.current?.(reason);
  }, []);

  // 初始化倒计时
  useEffect(() => {
    endedRef.current = false;
    generationRef.current += 1;
    expireAtRef.current = resolveExpireAtMs(expireTime);
    const sec = Math.max(0, Math.floor((expireAtRef.current - Date.now()) / 1000));
    setCountdownSec(sec);
    setCandidates([]);
    setSelectedGrabIds([]);
    setDetail(null);
    setOrderPending(false);
    if (sec <= 0) {
      finishEnded("expired");
    }
  }, [expireTime, finishEnded, requestNo]);

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
        const nextExpire = new Date(nextDetail.expireTime).getTime();
        if (Number.isFinite(nextExpire)) expireAtRef.current = nextExpire;
      }
      if (!isQuickMatchActive(nextDetail)) {
        if (nextDetail.status === "EXPIRED" || nextDetail.status === "MATCHING") {
          finishEnded("expired");
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
    } catch {
      // 网络失败保留视图，等待下次轮询
    } finally {
      pollBusyRef.current = false;
    }
  }, [finishEnded, token]);

  // 倒计时
  useEffect(() => {
    if (!requestNo || orderPending || endedRef.current) return;
    const timer = setInterval(() => {
      if (orderPendingRef.current || endedRef.current) return;
      const sec = Math.max(0, Math.floor((expireAtRef.current - Date.now()) / 1000));
      setCountdownSec(sec);
      if (sec <= 0) finishEnded("expired");
    }, 1000);
    return () => clearInterval(timer);
  }, [finishEnded, orderPending, requestNo]);

  // 抢单轮询
  useEffect(() => {
    if (!requestNo || !token || orderPending) return;
    void pollGrabList();
    const timer = setInterval(() => {
      void pollGrabList();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [orderPending, pollGrabList, requestNo, token]);

  const cancelMatching = useCallback(async (): Promise<boolean> => {
    const no = requestNo;
    if (!no || !token || submitting) return false;
    setSubmitting(true);
    try {
      await cancelQuickMatch(no, token);
      finishEnded("cancelled", "已取消派单");
      return true;
    } catch (error) {
      Toast.show(error instanceof Error ? error.message : "取消派单失败，请稍后重试", {
        duration: Toast.durations.SHORT,
      });
      void pollGrabList();
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [finishEnded, pollGrabList, requestNo, submitting, token]);

  const toggleGrab = useCallback((grabId: string) => {
    setSelectedGrabIds((prev) => {
      if (prev.includes(grabId)) {
        return prev.filter((id) => id !== grabId);
      }
      if (prev.length >= MAX_GRAB_SELECT) {
        Toast.show("最多选择3名陪玩", { duration: Toast.durations.SHORT });
        return prev;
      }
      return [...prev, grabId];
    });
  }, []);

  return {
    requestNo,
    detail,
    candidates,
    selectedGrabIds,
    countdownSec,
    countdownText: formatCountdown(countdownSec),
    submitting,
    orderPending,
    setSubmitting,
    setOrderPending,
    cancelMatching,
    toggleGrab,
  };
}
