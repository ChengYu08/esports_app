import { useEffect, useMemo, useState } from "react";

import { useQuery } from "@tanstack/react-query";

import { fetchActivityDetail } from "../api/activity.api";

export const activityDetailQueryKey = (activityCode: string) =>
  ["activity-seckill", "detail", activityCode] as const;

/** 秒杀活动详情查询。 */
export function useActivityDetail(activityCode: string) {
  return useQuery({
    queryKey: activityDetailQueryKey(activityCode),
    queryFn: ({ signal }) => fetchActivityDetail(activityCode, signal),
    enabled: Boolean(activityCode),
  });
}

/**
 * 倒计时 hook：用 detail.serverTime 校准本地时钟 offset，本地 1s tick。
 * 不轮询库存，剩余名额以进页时快照为准。
 */
export function useActivityCountdown(serverTime?: string) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  // offset = serverTime - Date.now()，无有效 serverTime 时为 0（按本地时钟）。
  const [offsetMs, setOffsetMs] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      // 每次心跳重算 offset，自动吸收详情异步到达后的 serverTime 校准。
      const serverMs = serverTime ? Date.parse(serverTime) : Number.NaN;
      setOffsetMs(Number.isFinite(serverMs) ? serverMs - Date.now() : 0);
      setNowMs(Date.now());
    }, 1000);
    return () => {
      clearInterval(timer);
    };
  }, [serverTime]);

  return useMemo(() => ({ nowMs, offsetMs }), [nowMs, offsetMs]);
}

/** 剩余毫秒数格式化为 HH:mm:ss（小时可超过两位）。 */
export function formatCountdown(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}
