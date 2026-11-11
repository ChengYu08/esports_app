import { useEffect, useState } from "react";
import type { NetInfoState } from "@react-native-community/netinfo";

/** 是否处于断网状态；netinfo 延迟加载，避开 iOS 首启联网授权弹窗期（同 use-network-recovery 口径） */
export function useIsOffline() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;

    void import("@react-native-community/netinfo")
      .then(({ default: NetInfo }) => {
        if (!active) return;
        void NetInfo.fetch()
          .then((state: NetInfoState) => {
            if (active) setOffline(!(state.isConnected ?? false));
          })
          .catch(() => undefined);
        unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
          setOffline(!(state.isConnected ?? false));
        });
      })
      .catch(() => undefined);

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  return offline;
}
