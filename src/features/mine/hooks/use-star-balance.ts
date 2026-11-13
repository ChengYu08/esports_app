import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";

import { fetchStarBalance } from "@/features/mine/api/companion-order.api";

type UseStarBalanceOptions = {
  /** 打开弹窗时的初始余额（如支付预览快照），可被焦点刷新覆盖 */
  initialBalance?: number | null;
  onError?: (error: Error) => void;
  /** 查询失败后由支付弹窗触发重试。 */
  refreshKey?: number;
};

/**
 * 支付弹窗余额：页面重新获得焦点时刷新（充值返回后余额自动更新）。
 */
export function useStarBalance(
  token: string | null,
  enabled: boolean,
  options: UseStarBalanceOptions = {},
): number | null {
  const { initialBalance = null, onError, refreshKey = 0 } = options;
  const [balance, setBalance] = useState<number | null>(initialBalance);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useFocusEffect(
    useCallback(() => {
      if (!enabled || !token) {
        return;
      }
      let cancelled = false;
      void fetchStarBalance(token)
        .then((next) => {
          if (!cancelled) setBalance(next);
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          onErrorRef.current?.(
            error instanceof Error ? error : new Error("钻石余额查询失败"),
          );
        });
      return () => {
        cancelled = true;
      };
    // refreshKey 是用户手动重试信号，变化时重新执行焦点请求。
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, token, refreshKey]),
  );

  return balance;
}
