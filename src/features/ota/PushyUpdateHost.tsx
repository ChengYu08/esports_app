import { type ReactNode, useEffect } from "react";
import { UpdateProvider, useUpdate } from "react-native-update";

import { pushyClient } from "./pushy-client";

type PushyUpdateHostProps = {
  children: ReactNode;
};

/** 挂载后开启原生检查并触发一次热更检查（需在 UpdateProvider 内） */
function PushyUpdateTrigger() {
  const { checkUpdate } = useUpdate();

  useEffect(() => {
    // Host 仅在同意隐私后挂载：恢复原生冷启动救援能力
    pushyClient?.setOptions({ disableNativeCheck: false });
    void checkUpdate();
  }, [checkUpdate]);

  return null;
}

/**
 * 隐私同意后挂载的热更新宿主。
 * 非 Android 或未配置 client 时直接透传 children。
 */
export function PushyUpdateHost({ children }: PushyUpdateHostProps) {
  if (pushyClient === null) {
    return children;
  }

  return (
    <UpdateProvider client={pushyClient}>
      <PushyUpdateTrigger />
      {children}
    </UpdateProvider>
  );
}
