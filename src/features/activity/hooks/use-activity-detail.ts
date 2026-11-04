import { useEffect, useMemo, useRef, useState } from "react";

import { useQuery } from "@tanstack/react-query";

import { fetchActivityDetail } from "../api/activity.api";
import { initCountdownState } from "./countdown";

export const activityDetailQueryKey = (activityCode: string) =>
  ["activity", "detail", activityCode] as const;

/** 秒杀活动详情查询。 */
export function useActivityDetail(activityCode: string) {
  return useQuery({
    queryKey: activityDetailQueryKey(activityCode),
    queryFn: ({ signal }) => fetchActivityDetail(activityCode, signal),
    enabled: Boolean(activityCode),
  });
}

/**
 * 倒计时 hook：用 detail.serverTime 校准本地时钟 offset（useMemo 以 serverTime 为稳定基准，
 * 数据到达时计算一次），本地 1s tick 仅更新 nowMs。
 * 不轮询库存，剩余名额以进页时快照为准。
 * 纯时间推进逻辑见 ./countdown（initCountdownState / tickCountdown）。
 */
export function useActivityCountdown(serverTime?: string) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [offsetMs, setOffsetMs] = useState(0);
  // 记录已校准过的 serverTime：每个值只校准一次 offset，后续 tick 不再重算（重算会冻结倒计时）。
  const calibratedRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const timer = setInterval(() => {
      const localNowMs = Date.now();
      setNowMs(localNowMs);
      if (calibratedRef.current !== serverTime) {
        calibratedRef.current = serverTime;
        setOffsetMs(initCountdownState(serverTime, localNowMs).offsetMs);
      }
    }, 1000);
    return () => {
      clearInterval(timer);
    };
  }, [serverTime]);

  return useMemo(() => ({ nowMs, offsetMs }), [nowMs, offsetMs]);
}

export { formatCountdown } from "./countdown";
