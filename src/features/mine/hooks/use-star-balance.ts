import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";

import { fetchStarBalance } from "@/features/mine/api/companion-order.api";

type UseStarBalanceOptions = {
  /** 打开弹窗时的初始余额（如支付预览快照），可被焦点刷新覆盖 */
  initialBalance?: number | null;
  onError?: (error: Error) => void;
};

/**
 * 支付弹窗余额：页面重新获得焦点时刷新（充值返回后余额自动更新）。
 */
export function useStarBalance(
  token: string | null,
  enabled: boolean,
  options: UseStarBalanceOptions = {},
): number | null {
  const { initialBalance = null, onError } = options;
  const [balance, setBalance] = useState<number | null>(initialBalance);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useFocusEffect(
    useCallback(() => {
      if (!enabled || !token) return;
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
    }, [enabled, token]),
  );

  return balance;
}
