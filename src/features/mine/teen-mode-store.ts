import { storage } from "@/core/storage/storage";

const TEEN_POPUP_CACHE_KEY = "mine:teen-popup";
const TEEN_ENABLED_MIRROR_KEY = "mine:teen-enabled-mirror";
const TEEN_CLOCK_OFFSET_KEY = "mine:teen-clock-offset";

/** 镜像与偏移按账号维度存储：多账号同设备互不串扰（未取到 userId 时退化为全局 key） */
function userScopedKey(base: string, userId?: string | null): string {
  return userId ? `${base}:${userId}` : base;
}

export type TeenPopupCache = {
  /** 勾选了"后续不再重复弹出"：永久不再弹（删除缓存后重新触发）。 */
  dontAsk: boolean;
  /** 最近一次弹窗关闭的日期（本地时区 YYYY-MM-DD）：当日不再弹。 */
  lastDismissedDate?: string;
};

export type TeenPopupCachePatch = {
  dontAsk?: boolean;
  lastDismissedDate?: string;
};

export async function readTeenPopupCache(): Promise<TeenPopupCache> {
  const raw = await storage.get(TEEN_POPUP_CACHE_KEY);
  if (!raw) {
    return { dontAsk: false };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<TeenPopupCache>;
    return {
      dontAsk: parsed.dontAsk === true,
      lastDismissedDate:
        typeof parsed.lastDismissedDate === "string"
          ? parsed.lastDismissedDate
          : undefined,
    };
  } catch {
    return { dontAsk: false };
  }
}

export async function saveTeenPopupCache(patch: TeenPopupCachePatch) {
  const current = await readTeenPopupCache();
  const next: TeenPopupCache = {
    dontAsk: patch.dontAsk ?? current.dontAsk,
    lastDismissedDate: patch.lastDismissedDate ?? current.lastDismissedDate,
  };
  await storage.set(TEEN_POPUP_CACHE_KEY, JSON.stringify(next));
}

/** 最近一次已知的服务端开启状态镜像（基础设置行展示用；以服务端 /youth/status 为准）。 */
export async function readLastTeenEnabled(
  userId?: string | null,
): Promise<boolean | null> {
  const raw = await storage.get(userScopedKey(TEEN_ENABLED_MIRROR_KEY, userId));
  if (raw === "true") {
    return true;
  }
  if (raw === "false") {
    return false;
  }
  return null;
}

export async function saveLastTeenEnabled(
  enabled: boolean,
  userId?: string | null,
) {
  await storage.set(
    userScopedKey(TEEN_ENABLED_MIRROR_KEY, userId),
    enabled ? "true" : "false",
  );
}

/**
 * 最近一次由 serverTime 计算的本地时钟偏移量（serverTime - Date.now()，毫秒）。
 * 锁定时段判定用它把本地时间校准成服务端时间，防止改设备时间/断网绕过；
 * null 表示从未校准过（只能退化为本地时间）。
 */
export async function readTeenClockOffset(
  userId?: string | null,
): Promise<number | null> {
  const raw = await storage.get(userScopedKey(TEEN_CLOCK_OFFSET_KEY, userId));
  if (raw === null || raw === undefined) {
    return null;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function saveTeenClockOffset(
  offsetMs: number,
  userId?: string | null,
) {
  await storage.set(
    userScopedKey(TEEN_CLOCK_OFFSET_KEY, userId),
    String(offsetMs),
  );
}
