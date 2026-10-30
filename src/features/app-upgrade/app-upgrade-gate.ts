import type { AppVersionVO } from "./app-upgrade.contract";

/** 对齐 pzdj-pc：trim + 去掉开头的 v/V 前缀 */
export function normalizeVersion(version: string): string {
  return version.trim().replace(/^[vV]/, "");
}

/** 严格数字点分格式（位数不限，如 1.0 / 1.0.0 / 1.0.0.1）；不合法返回 null */
function toComparableSegments(version: string): number[] | null {
  if (!/^\d+(\.\d+)+$/.test(version)) return null;
  return version.split(".").map(Number);
}

function compareSegments(left: number[], right: number[]): number {
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i += 1) {
    // 缺省段视为 0（1.0 == 1.0.0）
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export type AppUpgradeDecision = {
  hasUpdate: boolean;
  forceUpdate: boolean;
  latest: AppVersionVO | null;
};

/**
 * 整包升级判定：仅当最新版本严格大于当前版本（x.y.z 逐段数值比较，回滚不提示）且带下载地址时视为有更新；
 * 任一版本号不符合严格 x.y.z 格式时不提示（fail-closed）。
 * 强制更新优先取后端算好的 needForceUpdate，缺失时回退版本自身的 forceUpdate。
 */
export function decideAppUpgrade(
  latest: AppVersionVO | null | undefined,
  currentVersion: string,
): AppUpgradeDecision {
  const latestVersionNo = latest?.versionNo
    ? normalizeVersion(latest.versionNo)
    : "";
  const current = normalizeVersion(currentVersion);
  const latestSegments = toComparableSegments(latestVersionNo);
  const currentSegments = toComparableSegments(current);
  if (
    !latest ||
    !latestSegments ||
    !currentSegments ||
    !latest.packageUrl ||
    compareSegments(latestSegments, currentSegments) <= 0
  ) {
    return { hasUpdate: false, forceUpdate: false, latest: latest ?? null };
  }
  const forceUpdate = (latest.needForceUpdate ?? latest.forceUpdate ?? 0) === 1;
  return { hasUpdate: true, forceUpdate, latest };
}
