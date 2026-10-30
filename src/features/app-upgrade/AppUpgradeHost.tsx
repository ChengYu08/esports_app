import { useEffect } from "react";
import { Platform } from "react-native";

import { AppUpgradeDialog } from "./AppUpgradeDialog";
import { kickOffStartupCheck } from "./app-upgrade.store";

/**
 * 隐私同意后挂载的整包升级宿主：启动时静默检查（仅 Android），
 * 有新版本时展示升级弹窗。检查逻辑与 Pushy 热更共用同一个启动检查结果。
 */
export function AppUpgradeHost() {
  useEffect(() => {
    if (Platform.OS !== "android") return;
    void kickOffStartupCheck();
  }, []);

  return <AppUpgradeDialog />;
}
