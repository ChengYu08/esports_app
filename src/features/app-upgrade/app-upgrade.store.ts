import { Platform } from "react-native";
import Constants from "expo-constants";
import { create } from "zustand";

import { logger } from "@/core/logging/logger";

import {
  computeFileMd5,
  decideMd5Verification,
  deleteApk,
  downloadApk,
  hasInstallPermission,
  installApk,
  isApkCached,
  openInstallPermissionSettings,
  reuseCachedApkIfVerified,
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

export type AppUpgradeDownloadErrorType =
  /** 下载包 MD5 校验失败，损坏文件已删除 */
  | "integrity"
  /** 网络/下载/安装等常规失败 */
  | null;

type AppUpgradeState = {
  /** 升级弹窗是否可见 */
  visible: boolean;
  hasUpdate: boolean;
  forceUpdate: boolean;
  latest: AppVersionVO | null;
  checking: boolean;
  downloadPhase: AppUpgradeDownloadPhase;
  /** 错误细分类型，弹窗按此区分提示文案 */
  downloadErrorType: AppUpgradeDownloadErrorType;
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
      // 重新弹出弹窗时清理上次下载尝试的残留状态，避免显示过期的失败提示；
      // 下载/安装进行中不打断，已缓存的下载文件保留（复用路径会重新校验 md5）
      const { downloadPhase } = useAppUpgradeStore.getState();
      const resettable =
        decision.hasUpdate &&
        downloadPhase !== "downloading" &&
        downloadPhase !== "installing";
      store.setState({
        checking: false,
        hasUpdate: decision.hasUpdate,
        forceUpdate: decision.forceUpdate,
        latest: decision.latest,
        visible: decision.hasUpdate,
        ...(resettable
          ? {
              downloadPhase: "idle" as const,
              downloadProgress: 0,
              downloadErrorType: null,
            }
          : {}),
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
  downloadErrorType: null,
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
      const expectedMd5 = latest?.md5?.trim().toLowerCase();

      let fileUri = isApkCached(downloadedApkUri) ? downloadedApkUri! : null;
      let md5Verified = false;
      if (!fileUri) {
        // 跨会话复用：上次已下载的 APK md5 校验通过才复用，免重新下载；
        // 下载中断的残包/同版本重传的旧包会被删除后重新下载
        fileUri = await reuseCachedApkIfVerified(latest?.versionNo, expectedMd5);
        if (fileUri) {
          md5Verified = true;
          logger.info("app_upgrade.cache_reuse", { fileUri });
          useAppUpgradeStore.setState({ downloadedApkUri: fileUri });
        }
      }
      if (!fileUri) {
        useAppUpgradeStore.setState({
          downloadPhase: "downloading",
          downloadProgress: 0,
          downloadErrorType: null,
        });
        // .tmp 有残留时 downloadApk 内部自动断点续传
        fileUri = await downloadApk(packageUrl, latest?.versionNo, (percent) => {
          useAppUpgradeStore.setState({ downloadProgress: percent });
        });
        useAppUpgradeStore.setState({ downloadedApkUri: fileUri });
      }

      // 完整性校验：后端提供 md5 时，对新下载与缓存复用两条路径都校验
      if (!expectedMd5) {
        logger.info("app_upgrade.md5_skip", { fileUri, reason: "no_expected" });
      } else if (md5Verified) {
        logger.info("app_upgrade.md5_match", { fileUri, reused: true });
      } else {
        const hashStartedAt = Date.now();
        let actualMd5: string | null = null;
        try {
          actualMd5 = await computeFileMd5(fileUri);
        } catch (hashError) {
          logger.warn("app_upgrade.md5_compute_failed", {
            fileUri,
            message:
              hashError instanceof Error ? hashError.message : String(hashError),
          });
        }
        logger.info("app_upgrade.md5_computed", {
          fileUri,
          md5: actualMd5,
          costMs: Date.now() - hashStartedAt,
        });
        // actualMd5 为 null 仅发生在本地模块不可用（Expo Go/旧构建），跳过校验
        if (actualMd5 === null) {
          logger.info("app_upgrade.md5_skip", {
            fileUri,
            reason: "module_unavailable",
          });
        } else if (
          decideMd5Verification(expectedMd5, actualMd5) === "mismatch"
        ) {
          logger.warn("app_upgrade.md5_mismatch", {
            fileUri,
            expected: expectedMd5,
            actual: actualMd5,
          });
          await deleteApk(fileUri);
          logger.info("app_upgrade.corrupt_apk_deleted", { fileUri });
          useAppUpgradeStore.setState({
            downloadedApkUri: null,
            downloadProgress: 0,
            downloadErrorType: "integrity",
            downloadPhase: "error",
          });
          return;
        } else {
          logger.info("app_upgrade.md5_match", { fileUri, md5: actualMd5 });
        }
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
      useAppUpgradeStore.setState({
        downloadPhase: "error",
        downloadErrorType: null,
      });
    }
  },

  /** 跳转系统设置开启安装权限；返回后重试 */
  openPermissionSettings: () => {
    void openInstallPermissionSettings();
    useAppUpgradeStore.setState({ downloadPhase: "idle" });
  },

  resetDownload: () => {
    useAppUpgradeStore.setState({
      downloadPhase: "idle",
      downloadProgress: 0,
      downloadErrorType: null,
    });
  },
}));

/** 供 Pushy 热更与宿主挂载点共用的启动检查入口 */
export function kickOffStartupCheck(): Promise<boolean> {
  return useAppUpgradeStore.getState().whenStartupCheckSettled();
}
