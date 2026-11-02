import { useEffect } from "react";

import { AppUpgradeDialog } from "./AppUpgradeDialog";
import { kickOffStartupCheck } from "./app-upgrade.store";

/**
 * 隐私同意后挂载的整包升级宿主：启动时静默检查，
 * 有新版本时展示升级弹窗。检查逻辑与 Pushy 热更共用同一个启动检查结果。
 */
export function AppUpgradeHost() {
  useEffect(() => {
    void kickOffStartupCheck();
  }, []);

  return <AppUpgradeDialog />;
}
