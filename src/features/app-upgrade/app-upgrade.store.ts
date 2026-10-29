import { Platform } from "react-native";
import Constants from "expo-constants";
import { create } from "zustand";

import { logger } from "@/core/logging/logger";

import {
  downloadApk,
  hasInstallPermission,
  installApk,
  isApkCached,
  openInstallPermissionSettings,
} from "./apk-installer";
import { appUpgradeApi } from "./app-upgrade.api";
import type { AppVersionVO } from "./app-upgrade.contract";
import { decideAppUpgrade } from "./app-upgrade-gate";

export type AppUpgradeDownloadPhase =
  | "idle"
  | "downloading"
  | "installing"
  | "error"
  /** 未授予"安装未知应用"权限，等待用户去系统设置开启 */
  | "need-permission";

type AppUpgradeState = {
  /** 升级弹窗是否可见 */
  visible: boolean;
  hasUpdate: boolean;
  forceUpdate: boolean;
  latest: AppVersionVO | null;
  checking: boolean;
  downloadPhase: AppUpgradeDownloadPhase;
  /** 0-100 */
  downloadProgress: number;
  /** 已下载完成的 APK 文件 uri，重试/授权返回后复用避免重新下载 */
  downloadedApkUri: string | null;
  startupCheck: (options?: { silent?: boolean }) => Promise<boolean>;
  /** 供 Pushy 热更等待整包检查结果；若检查尚未启动会先触发一次 */
  whenStartupCheckSettled: () => Promise<boolean>;
  /** 手动检查（关于页），失败时抛出错误由调用方提示 */
  checkNow: () => Promise<boolean>;
  closeDialog: () => void;
  /** 确认更新：校验安装权限 → 下载 APK（已缓存则复用）→ 拉起安装器 */
  confirmUpdate: () => Promise<void>;
  /** 跳转系统设置开启安装权限；返回后重试 */
  openPermissionSettings: () => void;
  /** 下载失败后重试前清理错误状态 */
  resetDownload: () => void;
};

const currentVersion = Constants.expoConfig?.version ?? "1.0.0";

function runCheck(silent: boolean): Promise<boolean> {
  const store = useAppUpgradeStore;
  return (async () => {
    if (Platform.OS !== "android") return false;
    store.setState({ checking: true });
    try {
      const latest = await appUpgradeApi.fetchLatestVersion("ANDROID", currentVersion);
      const decision = decideAppUpgrade(latest, currentVersion);
      store.setState({
        checking: false,
        hasUpdate: decision.hasUpdate,
        forceUpdate: decision.forceUpdate,
        latest: decision.latest,
        visible: decision.hasUpdate,
      });
      return decision.hasUpdate;
    } catch (error) {
      store.setState({ checking: false });
      if (!silent) throw error;
      logger.warn("app_upgrade.check_failed", {
        message: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  })();
}

let startupCheckPromise: Promise<boolean> | null = null;

export const useAppUpgradeStore = create<AppUpgradeState>(() => ({
  visible: false,
  hasUpdate: false,
  forceUpdate: false,
  latest: null,
  checking: false,
  downloadPhase: "idle",
  downloadProgress: 0,
  downloadedApkUri: null,

  startupCheck: () => {
    if (!startupCheckPromise) {
      startupCheckPromise = runCheck(true);
    }
    return startupCheckPromise;
  },

  whenStartupCheckSettled: () => {
    if (!startupCheckPromise) {
      startupCheckPromise = runCheck(true);
    }
    return startupCheckPromise;
  },

  checkNow: () => runCheck(false),

  closeDialog: () => {
    const { forceUpdate, downloadPhase } = useAppUpgradeStore.getState();
    if (forceUpdate || downloadPhase === "downloading" || downloadPhase === "installing") {
      return;
    }
    useAppUpgradeStore.setState({ visible: false });
  },

  confirmUpdate: async () => {
    const { latest, downloadPhase, downloadedApkUri } =
      useAppUpgradeStore.getState();
    const packageUrl = latest?.packageUrl;
    if (
      !packageUrl ||
      downloadPhase === "downloading" ||
      downloadPhase === "installing"
    ) {
      return;
    }

    try {
      let fileUri = isApkCached(downloadedApkUri) ? downloadedApkUri! : null;
      if (!fileUri) {
        useAppUpgradeStore.setState({
          downloadPhase: "downloading",
          downloadProgress: 0,
        });
        fileUri = await downloadApk(packageUrl, latest?.packageFileName, (percent) => {
          useAppUpgradeStore.setState({ downloadProgress: percent });
        });
        useAppUpgradeStore.setState({ downloadedApkUri: fileUri });
      }

      useAppUpgradeStore.setState({ downloadPhase: "installing" });
      const installed = await installApk(fileUri);
      if (installed) {
        useAppUpgradeStore.setState({ downloadPhase: "idle" });
        return;
      }
      // 安装器未完成：用权限检查区分"未授权"与"用户取消"
      if (!(await hasInstallPermission())) {
        useAppUpgradeStore.setState({ downloadPhase: "need-permission" });
      } else {
        useAppUpgradeStore.setState({ downloadPhase: "idle" });
      }
    } catch (error) {
      logger.warn("app_upgrade.install_failed", {
        message: error instanceof Error ? error.message : String(error),
      });
      useAppUpgradeStore.setState({ downloadPhase: "error" });
    }
  },

  /** 跳转系统设置开启安装权限；返回后重试 */
  openPermissionSettings: () => {
    void openInstallPermissionSettings();
    useAppUpgradeStore.setState({ downloadPhase: "idle" });
  },

  resetDownload: () => {
    useAppUpgradeStore.setState({ downloadPhase: "idle", downloadProgress: 0 });
  },
}));

/** 供 Pushy 热更与宿主挂载点共用的启动检查入口 */
export function kickOffStartupCheck(): Promise<boolean> {
  return useAppUpgradeStore.getState().whenStartupCheckSettled();
}
