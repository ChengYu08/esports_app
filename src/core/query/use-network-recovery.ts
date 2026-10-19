import { useNetInfo } from "@react-native-community/netinfo";
import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useQueryClient } from "@tanstack/react-query";

/**
 * iOS 首次启动时系统联网授权弹窗会导致首批请求全部失败并被缓存。
 * 网络恢复（用户点击允许后）或 app 回到前台时，自动重刷所有失败的查询。
 */
export function useNetworkRecovery() {
  const queryClient = useQueryClient();
  const netInfo = useNetInfo();
  const wasOffline = useRef(true);

  const refetchFailedQueries = () => {
    queryClient.invalidateQueries({
      refetchType: "all",
      predicate: (query) => query.state.status === "error",
    });
  };

  useEffect(() => {
    const isConnected = netInfo.isConnected ?? false;
    if (isConnected && wasOffline.current) {
      wasOffline.current = false;
      refetchFailedQueries();
    }
    if (!isConnected) {
      wasOffline.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [netInfo.isConnected, queryClient]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        refetchFailedQueries();
      }
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient]);
}
