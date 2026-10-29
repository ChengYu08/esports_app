import * as IntentLauncher from "expo-intent-launcher";
import Constants from "expo-constants";
import { File, Paths } from "expo-file-system";
import { getContentUriAsync } from "expo-file-system/legacy";
import { PermissionsAndroid, Platform } from "react-native";

import ExpoAppPermission from "../../../modules/expo-app-permission";

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
    const granted = ExpoAppPermission?.canRequestPackageInstalls();
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

export function resolveApkFileName(
  packageUrl: string,
  packageFileName?: string,
): string {
  if (packageFileName && packageFileName.trim() !== "") {
    return packageFileName.trim();
  }
  const lastSegment = packageUrl.split("?")[0].split("/").pop() ?? "";
  try {
    return decodeURIComponent(lastSegment) || "update.apk";
  } catch {
    return lastSegment || "update.apk";
  }
}

/**
 * 下载 APK 到缓存目录，返回文件 uri。
 * onProgress 回传 0-100 的整数进度；下载失败/取消时抛出错误。
 */
export async function downloadApk(
  packageUrl: string,
  packageFileName: string | undefined,
  onProgress: (percent: number) => void,
): Promise<string> {
  const destination = new File(
    Paths.cache,
    resolveApkFileName(packageUrl, packageFileName),
  );
  if (destination.exists) {
    destination.delete();
  }

  const task = File.createDownloadTask(packageUrl, destination, {
    onProgress: ({ bytesWritten, totalBytes }) => {
      if (totalBytes <= 0) return;
      onProgress(Math.min(100, Math.round((bytesWritten / totalBytes) * 100)));
    },
  });

  const downloaded = await task.downloadAsync();
  if (!downloaded) {
    throw new Error("下载已取消");
  }
  return downloaded.uri;
}

/** 之前下载的 APK 文件是否仍可用 */
export function isApkCached(fileUri: string | null): boolean {
  if (!fileUri) return false;
  const file = new File(fileUri);
  return file.exists;
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
