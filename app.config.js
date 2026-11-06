/**
 * 版本号唯一源头是 app.json 的 expo.version（CI 可用 APP_VERSION 覆盖）。
 * Android versionCode 与 iOS buildNumber 均由它按 semver 推导，保证双端同步。
 * android/ 目录由 prebuild 重新生成，本文件注入的值会被 Expo 写入生成的
 * build.gradle，禁止手改 android/ 下的文件。
 */
const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)$/;

// semver → 数字构建号：major*10000 + minor*100 + patch。
// 约束：major/minor/patch 每段必须 < 100（major 另需 < 214748 以免超出 Android int 上限）。
function deriveVersionCode(version) {
  const match = SEMVER_RE.exec(version?.trim() ?? "");
  if (!match) {
    return null;
  }
  return Number(match[1]) * 10000 + Number(match[2]) * 100 + Number(match[3]);
}

module.exports = ({ config }) => {
  const appVersion = process.env.APP_VERSION?.trim();
  const appBuildNumber = process.env.APP_BUILD_NUMBER?.trim();
  const effectiveVersion = appVersion || config.version;
  const versionCode = deriveVersionCode(effectiveVersion);
  const iosBuildNumber =
    appBuildNumber || (versionCode != null ? String(versionCode) : undefined);

  return {
    ...config,
    ...(appVersion ? { version: appVersion } : {}),
    ...(versionCode != null
      ? { android: { ...config.android, versionCode } }
      : {}),
    ios: {
      ...config.ios,
      ...(iosBuildNumber ? { buildNumber: iosBuildNumber } : {}),
    },
  };
};

module.exports.deriveVersionCode = deriveVersionCode;
