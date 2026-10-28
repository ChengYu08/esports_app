import type { OtaConfig, OtaUpdateStrategy } from "./ota-config.contract";

const UPDATE_STRATEGIES = new Set<OtaUpdateStrategy>([
  "alwaysAlert",
  "alertUpdateAndIgnoreError",
  "silentAndNow",
  "silentAndLater",
  null,
]);

/** 解析配置值 JSON；任何不合法（非对象、version 非法、updateStrategy 未知）返回 null */
export function parseOtaConfig(
  rawValue: string | null | undefined,
): OtaConfig | null {
  if (rawValue === null || rawValue === undefined || rawValue.trim() === "") {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawValue);
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }
  const raw = parsed as Record<string, unknown>;
  const version = raw.version;
  if (typeof version !== "number" || !Number.isSafeInteger(version) || version < 0) {
    return null;
  }
  const config: OtaConfig = { version };
  if (raw.updateStrategy !== undefined) {
    if (!UPDATE_STRATEGIES.has(raw.updateStrategy as OtaUpdateStrategy)) {
      return null;
    }
    config.updateStrategy = raw.updateStrategy as OtaUpdateStrategy;
  }
  // 旧配置若仍带 checkStrategy，忽略该字段，不因此判非法
  return config;
}

export type OtaGateResult = { trigger: boolean; config: OtaConfig | null };

/**
 * 热更门禁判定：仅当配置版本号大于本地 RN_BUNDLE_VERSION 时触发检查。
 * 无配置、配置非法时一律不触发（fail-closed）。
 */
export function decideOtaGate(
  rawValue: string | null | undefined,
  localVersion: number,
): OtaGateResult {
  const config = parseOtaConfig(rawValue);
  if (config === null) return { trigger: false, config: null };
  return { trigger: config.version > localVersion, config };
}
