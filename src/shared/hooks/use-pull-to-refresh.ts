import { useCallback, useEffect, useRef, useState } from "react";

/** 后台查询的重新请求不得激活原生下拉刷新控件。 */
export function usePullToRefresh(
  action: () => Promise<unknown>,
  scope = "default",
) {
  const [refreshingScope, setRefreshingScope] = useState<string | null>(null);
  const running = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const onRefresh = useCallback(() => {
    if (running.current) return;
    running.current = true;
    setRefreshingScope(scope);
    void (async () => {
      try {
        await action();
      } catch {
        // 查询 hooks 会保留错误状态，并渲染各自已有的重试界面。
      } finally {
        running.current = false;
        if (mounted.current) setRefreshingScope(null);
      }
    })();
  }, [action, scope]);

  return { refreshing: refreshingScope === scope, onRefresh };
}
