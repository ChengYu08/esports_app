import { type ReactNode, useEffect, useRef } from "react";
import { UpdateProvider, useUpdate } from "react-native-update";

import { logger } from "@/core/logging/logger";

import { OTA_CONFIG_KEY, otaConfigApi } from "./ota-config.api";
import { decideOtaGate } from "./ota-update-gate";
import { pushyClient } from "./pushy-client";
import { RN_BUNDLE_VERSION } from "./rn-bundle-version";

type PushyUpdateHostProps = {
  children: ReactNode;
};

/**
 * 挂载后开启原生检查，并从配置中心拉取热更门禁配置：
 * 仅当远端 version 大于本地 RN_BUNDLE_VERSION 时才触发一次 checkUpdate（失败/无配置则不检查）。
 * 发版：改 RN_BUNDLE_VERSION → 打 ppk → 后台把 pzdj_app_rn_update_config.version 调到相同值。
 */
function PushyUpdateTrigger() {
  const { checkUpdate } = useUpdate();
  // setOptions 会改变 checkUpdate 身份，防止重复执行
  const gateDone = useRef(false);

  useEffect(() => {
    if (gateDone.current) return;
    gateDone.current = true;

    // Host 仅在同意隐私后挂载：恢复原生冷启动救援能力
    pushyClient?.setOptions({ disableNativeCheck: false });

    void (async () => {
      try {
        const rawConfig = await otaConfigApi.fetchOtaConfig(OTA_CONFIG_KEY);
        const gate = decideOtaGate(rawConfig, RN_BUNDLE_VERSION);
        if (!gate.trigger || gate.config === null) {
          logger.debug("ota.gate_blocked", { localVersion: RN_BUNDLE_VERSION });
          return;
        }

        if (gate.config.updateStrategy !== undefined) {
          pushyClient?.setOptions({
            updateStrategy: gate.config.updateStrategy,
          });
        }
        void checkUpdate();
      } catch {
        // 配置拿不到时不发起热更检查（fail-closed），静默处理
        logger.warn("ota.config_fetch_failed");
      }
    })();
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
