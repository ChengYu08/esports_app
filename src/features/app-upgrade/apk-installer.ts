import * as IntentLauncher from "expo-intent-launcher";
import Constants from "expo-constants";
import {
  DownloadTask,
  File,
  Paths,
  type DownloadPauseState,
  type DownloadProgress,
} from "expo-file-system";
import { getContentUriAsync } from "expo-file-system/legacy";
import { PermissionsAndroid, Platform } from "react-native";

import ExpoAppToolkit from "../../../modules/expo-app-toolkit";

import { logger } from "@/core/logging/logger";

import { decideMd5Verification } from "./apk-verification";

const APK_MIME_TYPE = "application/vnd.android.package-archive";
/** FLAG_GRANT_READ_URI_PERMISSION */
const FLAG_GRANT_READ = 1;

/** Android 8+ 的"安装未知应用"开关不是常规运行时权限，只能检查 + 引导用户去设置开启 */
const REQUEST_INSTALL_PACKAGES =
  "android.permission.REQUEST_INSTALL_PACKAGES" as Parameters<
    typeof PermissionsAndroid.check
  >[0];

/** 当前是否已授予"安装未知应用"权限 */
export async function hasInstallPermission(): Promise<boolean> {
  if (Platform.OS !== "android") return false;
  try {
    const granted = ExpoAppToolkit?.canRequestPackageInstalls();
    if (typeof granted === "boolean") return granted;
  } catch {
    // 本地模块不可用时回退到系统权限检查（部分 ROM 上不可靠，仅兜底）
  }
  return PermissionsAndroid.check(REQUEST_INSTALL_PACKAGES);
}

/** 跳转本应用的"安装未知应用"系统设置页 */
export function openInstallPermissionSettings(): Promise<unknown> {
  const packageName = Constants.expoConfig?.android?.package;
  return IntentLauncher.startActivityAsync(
    IntentLauncher.ActivityAction.MANAGE_UNKNOWN_APP_SOURCES,
    { data: packageName ? `package:${packageName}` : undefined },
  );
}

/** 下载落地文件名用纯 ASCII（版本号），规避中文文件名在各环节的百分号编码问题 */
export function resolveApkDownloadName(versionNo: string | undefined): string {
  const safeVersion = versionNo?.trim().replace(/[^\w.-]/g, "");
  return safeVersion ? `update-${safeVersion}.apk` : "update.apk";
}

/** 下载中间文件：下载/续传写入 .tmp，完成后改名 .apk，使 .apk 始终代表完整文件 */
function resolveApkTmpName(versionNo: string | undefined): string {
  return `${resolveApkDownloadName(versionNo)}.tmp`;
}

/**
 * 下载 APK 到缓存目录，返回文件 uri。
 * 下载写入 .tmp 中间文件，完成后改名为 .apk；因此 .apk 的存在即代表下载完整。
 * onProgress 回传 0-100 的整数进度；下载失败/取消时抛出错误。
 * 存在 .tmp 残留时走断点续传（Range 请求）；续传失败保留断点直接抛错，重试从新 offset 继续。
 */
export async function downloadApk(
  packageUrl: string,
  versionNo: string | undefined,
  onProgress: (percent: number) => void,
): Promise<string> {
  const destination = new File(Paths.cache, resolveApkDownloadName(versionNo));
  const tmpFile = new File(Paths.cache, resolveApkTmpName(versionNo));

  const handleProgress = ({ totalBytes, bytesWritten }: DownloadProgress) => {
    if (totalBytes <= 0) return;
    onProgress(Math.min(100, Math.round((bytesWritten / totalBytes) * 100)));
  };

  // 断点续传：.tmp 残留即从断点继续
  if (tmpFile.exists && (tmpFile.size ?? 0) > 0) {
    const offset = tmpFile.size ?? 0;
    logger.info("app_upgrade.download_resume_start", {
      packageUrl,
      fileName: tmpFile.uri,
      offset,
    });
    const startedAt = Date.now();
    const state: DownloadPauseState = {
      url: packageUrl,
      fileUri: tmpFile.uri,
      isDirectory: false,
      resumeData: String(offset),
    };
    let resumed: File | null;
    try {
      resumed = await DownloadTask.fromSavable(state, {
        onProgress: handleProgress,
      }).resumeAsync();
    } catch (error) {
      logger.warn("app_upgrade.download_resume_failed", {
        packageUrl,
        fileName: tmpFile.uri,
        offset,
        message: error instanceof Error ? error.message : String(error),
      });
      // 416 = 断点 offset 已达服务端文件大小，.tmp 实际已下载完整
      //（上次恰好下完最后一字节但连接中断），改名走后续 md5 校验
      if (error instanceof Error && error.message.includes("HTTP 416")) {
        logger.info("app_upgrade.download_resume_complete", {
          fileName: tmpFile.uri,
          offset,
        });
        return await finalizeDownloadedApk(tmpFile, destination);
      }
      // 保留 .tmp：本次失败前新下载的字节留在断点上，重试时从新 offset 继续续传；
      // 严禁降级为全量下载，否则会删掉断点、把之前累积的进度全部丢掉
      throw error;
    }
    if (resumed) {
      logger.info("app_upgrade.download_done", {
        fileUri: destination.uri,
        resumed: true,
        costMs: Date.now() - startedAt,
      });
      return await finalizeDownloadedApk(tmpFile, destination);
    }
    throw new Error("下载已取消");
  }

  // 全量下载：仅在无 .tmp 残留（或残留为 0 字节）时走到这里
  if (tmpFile.exists) {
    tmpFile.delete();
  }

  const startedAt = Date.now();
  logger.info("app_upgrade.download_start", {
    packageUrl,
    fileName: tmpFile.uri,
  });

  const task = File.createDownloadTask(packageUrl, tmpFile, {
    onProgress: handleProgress,
  });

  const downloaded = await task.downloadAsync().catch((error: unknown) => {
    logger.warn("app_upgrade.download_failed", {
      packageUrl,
      fileName: tmpFile.uri,
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  });
  if (!downloaded) {
    logger.warn("app_upgrade.download_failed", {
      packageUrl,
      fileName: tmpFile.uri,
      message: "下载已取消",
    });
    throw new Error("下载已取消");
  }
  logger.info("app_upgrade.download_done", {
    fileUri: tmpFile.uri,
    costMs: Date.now() - startedAt,
  });
  return await finalizeDownloadedApk(tmpFile, destination);
}

/** .tmp → .apk；overwrite 处理极端情况下同名 .apk 残留 */
async function finalizeDownloadedApk(
  tmpFile: File,
  destination: File,
): Promise<string> {
  await tmpFile.move(destination, { overwrite: true });
  return destination.uri;
}

/** 之前下载的 APK 文件是否仍可用 */
export function isApkCached(fileUri: string | null): boolean {
  if (!fileUri) return false;
  const file = new File(fileUri);
  return file.exists;
}

/**
 * 计算本地文件 MD5（小写 32 位 hex）。
 * 非 Android 或本地模块不可用（Expo Go/旧构建）返回 null，调用方跳过校验；
 * 文件读取失败向上抛错，由调用方按校验失败处理。
 */
export async function computeFileMd5(
  fileUri: string,
): Promise<string | null> {
  if (Platform.OS !== "android") return null;
  if (!ExpoAppToolkit?.md5File) return null;
  return (await ExpoAppToolkit.md5File(fileUri)).toLowerCase();
}

/** 下载包完整性判定：后端未提供 md5 → 跳过；本地文件不可读 → 视为损坏 */
export { decideMd5Verification } from "./apk-verification";

/** 删除损坏的下载文件；删除失败仅忽略，不阻塞错误提示流程 */
export async function deleteApk(fileUri: string): Promise<void> {
  try {
    const file = new File(fileUri);
    if (file.exists) file.delete();
  } catch {
    // 缓存文件删除失败不影响重新下载（downloadApk 会覆盖同名文件）
  }
}

/**
 * 跨会话复用缓存中已下载的 APK：文件存在且 md5 与后端一致时返回其 uri，免重新下载。
 * 后端未提供 md5、文件缺失/不可读或校验不通过（旧文件将被删除）时返回 null，走重新下载。
 */
export async function reuseCachedApkIfVerified(
  versionNo: string | undefined,
  expectedMd5: string | undefined,
): Promise<string | null> {
  const expected = expectedMd5?.trim().toLowerCase();
  if (!expected) return null;
  const cached = new File(Paths.cache, resolveApkDownloadName(versionNo));
  if (!cached.exists) return null;
  try {
    const actualMd5 = await computeFileMd5(cached.uri);
    if (actualMd5 === null) return null;
    if (decideMd5Verification(expected, actualMd5) === "match") {
      return cached.uri;
    }
    // 下载中断的残包/同版本重传的旧包都会走到这里
    logger.info("app_upgrade.cache_reuse_rejected", {
      fileName: cached.uri,
      reason: "md5_mismatch",
      expected,
      actual: actualMd5,
    });
  } catch {
    logger.info("app_upgrade.cache_reuse_rejected", {
      fileName: cached.uri,
      reason: "unreadable",
    });
  }
  await deleteApk(cached.uri);
  return null;
}

/** Activity.RESULT_OK */
const RESULT_OK = -1;

/**
 * 拉起系统安装器，返回用户是否完成了安装。
 * 注意 REQUEST_INSTALL_PACKAGES 的 checkSelfPermission 在部分 ROM（如 MIUI）上
 * 不可靠，真实授权状态以安装器返回结果为准。
 */
export async function installApk(fileUri: string): Promise<boolean> {
  const contentUri = await getContentUriAsync(fileUri);
  const result = await IntentLauncher.startActivityAsync(
    "android.intent.action.INSTALL_PACKAGE",
    { data: contentUri, type: APK_MIME_TYPE, flags: FLAG_GRANT_READ },
  );
  return result.resultCode === RESULT_OK;
}
