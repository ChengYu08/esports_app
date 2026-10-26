import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import type { NetInfoState } from "@react-native-community/netinfo";

/**
 * iOS 首次启动时系统联网授权弹窗会导致首批请求全部失败并被缓存。
 * 网络恢复（用户点击允许后）或 app 回到前台时，自动重刷所有失败的查询。
 */
export function useNetworkRecovery() {
  const queryClient = useQueryClient();
  const wasOffline = useRef(true);

  const refetchFailedQueries = useCallback(() => {
    queryClient.invalidateQueries({
      refetchType: "all",
      predicate: (query) => query.state.status === "error",
    });
  }, [queryClient]);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;

    // Load NetInfo only after the consent gate has mounted this component.
    void import("@react-native-community/netinfo").then(({ default: NetInfo }) => {
      if (!active) return;
      unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
        const isConnected = state.isConnected ?? false;
        if (isConnected && wasOffline.current) {
          wasOffline.current = false;
          refetchFailedQueries();
        }
        if (!isConnected) {
          wasOffline.current = true;
        }
      });
    });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [refetchFailedQueries]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        refetchFailedQueries();
      }
    });
    return () => sub.remove();
  }, [refetchFailedQueries]);
}
