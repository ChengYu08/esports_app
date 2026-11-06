import { useEffect, useState } from "react";
import { AppState } from "react-native";

import { useMessageStore } from "../message-store";

/** 消息页可见时的在线状态轮询间隔 */
export const ONLINE_STATUS_POLL_INTERVAL_MS = 5_000;
/** 连续失败后的最大退避间隔 */
export const ONLINE_STATUS_POLL_MAX_BACKOFF_MS = 30_000;

/**
 * 消息页可见期间轮询会话对端在线状态。
 * 门控：仅 enabled（页面聚焦 + 有真实会话）且 App 前台时计时；
 * 串行：上一轮返回后才排下一轮；失败按 5s/10s/20s/30s 退避，成功立即回到 5s。
 */
export function useOnlineStatusPolling(enabled: boolean, token: string | null) {
  const refreshOnlineStatuses = useMessageStore(
    (state) => state.refreshOnlineStatuses,
  );
  const [appActive, setAppActive] = useState(
    () => AppState.currentState === "active",
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      setAppActive(state === "active");
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!enabled || !appActive || !token) {
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;

    const schedule = (delay: number) => {
      timer = setTimeout(async () => {
        const succeeded = await refreshOnlineStatuses(token);
        if (cancelled) {
          return;
        }
        failures = succeeded ? 0 : failures + 1;
        const nextDelay = failures === 0
          ? ONLINE_STATUS_POLL_INTERVAL_MS
          : Math.min(
              ONLINE_STATUS_POLL_INTERVAL_MS * 2 ** failures,
              ONLINE_STATUS_POLL_MAX_BACKOFF_MS,
            );
        schedule(nextDelay);
      }, delay);
    };

    schedule(ONLINE_STATUS_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [appActive, enabled, refreshOnlineStatuses, token]);
}
