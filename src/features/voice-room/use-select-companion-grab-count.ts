import { useAuthStore } from "@esports/auth";
import { useCallback, useEffect, useRef, useState } from "react";

import { fetchQuickMatchGrabList } from "@/features/match/api/match.api";

/** 与匹配中页抢单轮询间隔一致 */
const POLL_INTERVAL_MS = 4000;

/**
 * 语聊房「选择大神」按钮抢单人数：仅轮询列表长度，不接管选人/结束逻辑。
 */
export function useSelectCompanionGrabCount(
  requestNo: string | undefined,
  enabled: boolean,
): number {
  const token = useAuthStore((state) => state.accessToken);
  const [grabCount, setGrabCount] = useState(0);
  const pollBusyRef = useRef(false);
  const requestNoRef = useRef(requestNo);
  const generationRef = useRef(0);

  useEffect(() => {
    requestNoRef.current = requestNo;
  }, [requestNo]);

  const pollGrabCount = useCallback(async () => {
    const no = requestNoRef.current;
    if (!no || !token || pollBusyRef.current) return;
    const generation = generationRef.current;
    pollBusyRef.current = true;
    try {
      const list = await fetchQuickMatchGrabList(no, token);
      if (generation !== generationRef.current || requestNoRef.current !== no) {
        return;
      }
      setGrabCount(list.length);
    } catch {
      // 网络失败保留上次人数，等待下次轮询
    } finally {
      pollBusyRef.current = false;
    }
  }, [token]);

  useEffect(() => {
    generationRef.current += 1;
    if (!enabled || !requestNo || !token) {
      setGrabCount(0);
      return;
    }
    setGrabCount(0);
    void pollGrabCount();
    const timer = setInterval(() => {
      void pollGrabCount();
    }, POLL_INTERVAL_MS);
    return () => {
      clearInterval(timer);
      generationRef.current += 1;
    };
  }, [enabled, pollGrabCount, requestNo, token]);

  return grabCount;
}
